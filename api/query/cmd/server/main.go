// Command server is api/query: read-only ClickHouse access for the
// explorers, dashboards, status pages and the Python services
// (system-design.md §4, §6.5). It keeps the members, orgs and monitors
// snapshots in memory and reloads one when upstat.config.changed names it.
package main

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
	// Usage months resolve in the org timezone (X-10); the image ships no zoneinfo.
	_ "time/tzdata"

	"golang.org/x/sync/errgroup"

	"github.com/cuesoftinc/upstat/api/common/pkg/bus"
	"github.com/cuesoftinc/upstat/api/common/pkg/httpx"
	"github.com/cuesoftinc/upstat/api/common/pkg/session"
	"github.com/cuesoftinc/upstat/api/common/pkg/snapshot"
	"github.com/cuesoftinc/upstat/api/common/pkg/store"
	"github.com/cuesoftinc/upstat/api/query/internal/chdb"
	"github.com/cuesoftinc/upstat/api/query/internal/handler"
	"github.com/cuesoftinc/upstat/api/query/internal/telemetry"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("exiting", "error", err)
		os.Exit(1)
	}
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func csv(raw string) []string {
	var out []string
	for _, p := range strings.Split(raw, ",") {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// origin is a URL's scheme://host, the form browsers send in Origin.
func origin(raw string) string {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme == "" || u.Host == "" {
		return ""
	}
	return u.Scheme + "://" + u.Host
}

func run() error {
	if len(os.Getenv("JWT_SECRET")) < 32 {
		return errors.New("JWT_SECRET must be at least 32 characters")
	}
	if os.Getenv("CLICKHOUSE_URL") == "" {
		return errors.New("CLICKHOUSE_URL is required")
	}
	allowed := map[string]bool{}
	for _, o := range append(csv(os.Getenv("CORS_ORIGINS")), env("WEB_URL", "http://localhost:3000")) {
		if o = origin(o); o != "" {
			allowed[o] = true
		}
	}
	isAllowed := func(o string) bool { return allowed[o] }
	session.ConfigureSession(session.SessionSettings{CookieName: env("SESSION_COOKIE_NAME", "upstat_session"), AllowedOrigin: isAllowed})

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	blobs, err := store.Open(ctx, store.Config{
		Driver: env("STORAGE_DRIVER", "gcs"), Bucket: os.Getenv("STORAGE_BUCKET"), Prefix: env("STORAGE_PREFIX", "upstat/local"),
		Endpoint: os.Getenv("STORAGE_ENDPOINT"), AccessKey: os.Getenv("STORAGE_ACCESS_KEY"), SecretKey: os.Getenv("STORAGE_SECRET_KEY"),
		UseSSL: strings.EqualFold(os.Getenv("STORAGE_USE_SSL"), "true"),
	})
	if err != nil {
		return err
	}
	access := snapshot.NewAccess(blobs)
	if err := access.Load(ctx); err != nil {
		return err
	}
	contract, err := bus.LoadContract()
	if err != nil {
		return err
	}
	kafka := bus.Config{Brokers: csv(env("KAFKA_BROKERS", "localhost:9092")), Username: os.Getenv("KAFKA_USERNAME"),
		Password: os.Getenv("KAFKA_PASSWORD"), SSLCA: os.Getenv("KAFKA_SSL_CA")}
	consumer, err := bus.NewConsumer(kafka, "upstat-query", bus.TopicRequests, map[string]bus.Handler{
		bus.EventConfigChanged: func(ctx context.Context, data json.RawMessage) error {
			var m struct {
				Kind string `json:"kind"`
			}
			if err := json.Unmarshal(data, &m); err != nil {
				return err
			}
			return access.Reload(ctx, m.Kind)
		},
	}, nil, contract, blobs)
	if err != nil {
		return err
	}

	ch := chdb.New(os.Getenv("CLICKHOUSE_URL"), os.Getenv("CLICKHOUSE_QUERY_USER"), os.Getenv("CLICKHOUSE_QUERY_PASSWORD"))
	svc := &telemetry.Service{CH: ch, Monitors: access.Monitors, Now: time.Now}
	api := handler.New(svc, access, handler.Internal{Audience: os.Getenv("INTERNAL_AUDIENCE"),
		Invokers: csv(os.Getenv("INTERNAL_INVOKERS")), Token: os.Getenv("INTERNAL_TOKEN")})
	if raw := os.Getenv("ACCESS_MAX_AGE"); raw != "" {
		d, err := time.ParseDuration(raw)
		if err != nil || d <= 0 {
			return errors.New("ACCESS_MAX_AGE must be a positive duration like 30s")
		}
		api.AccessMaxAge = d
	}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "up"})
	})
	mux.HandleFunc("GET /ready", func(w http.ResponseWriter, r *http.Request) {
		if err := ch.Ping(r.Context()); err != nil || !consumer.Running() {
			httpx.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not ready"})
			return
		}
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})
	api.Register(mux)
	srv := &http.Server{Addr: ":" + env("PORT", "8083"), Handler: httpx.CORS(isAllowed, true, mux), ReadHeaderTimeout: 10 * time.Second}

	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error { return consumer.Run(gctx) })
	g.Go(func() error {
		slog.Info("listening", "addr", srv.Addr)
		if err := srv.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	})
	g.Go(func() error {
		<-gctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return srv.Shutdown(shutdown)
	})
	return g.Wait()
}
