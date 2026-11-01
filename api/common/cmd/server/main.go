// Command server is api/common: the control-plane HTTP API, the check
// scheduler and relay, the outbox publisher and the Kafka consumers that
// persist analytics' decisions, in one process (system-design.md §4). In
// cloud it scales to zero: Cloud Scheduler calls
// POST /internal/jobs/run-checks every minute, and whatever publishes for
// it wakes it (shared messaging contract, "Scale to zero").
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
	// Org timezones are IANA names (X-10); the image ships no zoneinfo.
	_ "time/tzdata"

	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
	"golang.org/x/sync/errgroup"

	"github.com/cuesoftinc/upstat/api/common/internal/auth"
	"github.com/cuesoftinc/upstat/api/common/internal/cache"
	"github.com/cuesoftinc/upstat/api/common/internal/clients"
	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/handler"
	"github.com/cuesoftinc/upstat/api/common/internal/jobs"
	"github.com/cuesoftinc/upstat/api/common/internal/outbox"
	"github.com/cuesoftinc/upstat/api/common/internal/ratelimit"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/internal/service"
	"github.com/cuesoftinc/upstat/api/common/migrations"
	"github.com/cuesoftinc/upstat/api/common/pkg/bus"
	"github.com/cuesoftinc/upstat/api/common/pkg/gcpauth"
	"github.com/cuesoftinc/upstat/api/common/pkg/httpx"
	"github.com/cuesoftinc/upstat/api/common/pkg/session"
	"github.com/cuesoftinc/upstat/api/common/pkg/store"
	"github.com/cuesoftinc/upstat/api/common/pkg/wake"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	if err := run(); err != nil {
		slog.Error("exiting", "error", err)
		os.Exit(1)
	}
}

func run() error {
	config.LoadEnv()
	authCfg, err := config.LoadAuth()
	if err != nil {
		return err
	}
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	session.SetAccessTTL(authCfg.JWTAccessTTL)
	session.ConfigureSession(session.SessionSettings{CookieName: authCfg.SessionCookieName, AllowedOrigin: authCfg.IsAllowedOrigin})

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := repository.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer db.Close()
	if err := migrations.Apply(ctx, db.Pool); err != nil {
		return err
	}
	if cfg.ClickHouseURL != "" {
		ch := migrations.ClickHouse{URL: cfg.ClickHouseURL, User: cfg.ClickHouseUser, Password: cfg.ClickHousePassword}
		if err := ch.Apply(ctx); err != nil {
			return err
		}
	}
	blobs, err := store.Open(ctx, cfg.Storage)
	if err != nil {
		return err
	}
	if err := outbox.WriteAll(ctx, db, blobs, time.Now()); err != nil {
		return err
	}
	contract, err := bus.LoadContract()
	if err != nil {
		return err
	}
	producer, err := bus.NewProducer(cfg.Kafka, contract, blobs)
	if err != nil {
		return err
	}
	defer producer.Close()

	signer := gcpauth.New()
	s := service.New(db, blobs, cfg, clients.NewProber(cfg.Probes, signer, cfg.InternalToken),
		clients.NewQuery(cfg.QueryURL, signer, cfg.InternalToken), clients.NewResults(cfg.OTLPEndpoint, signer))
	limiter := ratelimit.New(cfg.Redis)
	defer limiter.Close()

	waker := wake.New(signer)
	waker.Token = cfg.InternalToken
	publisher := &outbox.Publisher{DB: db, Producer: producer, Store: blobs, Interval: time.Second, Now: time.Now,
		Wake: func(event string) {
			switch event {
			case bus.EventConfigChanged:
				waker.Async(cfg.Wake.Analytics, event)
				waker.Async(cfg.Wake.Observability, event)
				waker.Async(cfg.Wake.Query, event)
			default: // synthetics.result, verify_requested
				waker.Async(cfg.Wake.Analytics, event)
			}
		}}

	consumer, err := bus.NewConsumer(cfg.Kafka, "upstat-common", bus.TopicResults, map[string]bus.Handler{
		bus.EventTransition:    s.OnTransition,
		bus.EventDelivery:      s.OnDelivery,
		bus.EventRuleEvaluated: s.OnRuleEvaluated,
		bus.EventSLOEvaluated:  s.OnSLOEvaluated,
		bus.EventInsight:       s.OnInsight,
	}, map[string]bus.Failure{
		bus.EventTransition: service.LogFailure(bus.EventTransition),
		bus.EventDelivery:   service.LogFailure(bus.EventDelivery),
	}, contract, blobs)
	if err != nil {
		return err
	}

	// Cloud Run bills CPU per request (S-14): background work stalls once a
	// request is answered. So a write publishes its outbox rows before it
	// answers, and each run-checks pass settles analytics (it evaluates and
	// handles every result) and then waits until common has handled the
	// transitions analytics sent back. Compose and Helm run every service
	// all the time and leave WAKE_ANALYTICS_URL unset.
	settle := cfg.Wake.Analytics != ""
	flush := func(ctx context.Context) {
		for {
			n, err := publisher.PublishBatch(ctx)
			if err != nil {
				slog.WarnContext(ctx, "outbox flush failed; the next pass retries", "error", err)
				return
			}
			if n == 0 {
				return
			}
		}
	}
	runChecks := runnerFunc(func(ctx context.Context) error {
		err := s.RunChecks(ctx)
		if !settle {
			return err
		}
		flush(ctx)
		// Each pass settles analytics even when no result was sent, so its
		// nodata timers and rules tick (flows/monitor.md §2).
		if serr := waker.Settle(ctx, cfg.Wake.Analytics, "run-checks"); serr == nil {
			if werr := consumer.WaitCaughtUp(ctx, 20*time.Second); werr != nil {
				slog.WarnContext(ctx, "results not all handled; the next pass continues", "error", werr)
			}
		}
		return err
	})

	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "up"})
	})
	mux.HandleFunc("GET /ready", func(w http.ResponseWriter, r *http.Request) {
		if err := db.Ping(r.Context()); err != nil || !consumer.Running() {
			httpx.WriteJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not ready"})
			return
		}
		httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ready"})
	})
	mux.Handle(jobs.Path, jobs.Handler{Verifier: jobs.GoogleVerifier{}, Checks: runChecks,
		Jobs: map[string]func(context.Context) error{jobs.PruneJob: s.Prune}})
	handler.NewAuthHandler(authCfg, cache.NewMemoryStore(),
		auth.NewGoogleSSO(authCfg.GoogleClientID, authCfg.GoogleClientSecret, authCfg.GoogleRedirectURI),
		auth.NewHandoffService(service.Handoffs{S: s}, authCfg.SessionSecret, session.GenerateSessionToken),
		service.AuthUsers{S: s},
	).Register(mux)
	api := &handler.API{S: s}
	if limiter != nil {
		api.Limiter = limiter
	}
	api.Register(mux)

	var app http.Handler = mux
	if settle {
		app = flushAfterWrites(mux, flush)
	}
	root := httpx.CORS(authCfg.IsAllowedOrigin, true, h2c.NewHandler(app, &http2.Server{}))
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: root, ReadHeaderTimeout: 10 * time.Second}

	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error { publisher.Run(gctx); return nil })
	g.Go(func() error { return consumer.Run(gctx) })
	if config.WorkerEnabled() {
		// Local runs only: Cloud Run drives checks from Cloud Scheduler.
		g.Go(func() error {
			ticker := time.NewTicker(config.RunChecksEvery)
			defer ticker.Stop()
			for {
				if err := runChecks.RunOnce(gctx); err != nil && gctx.Err() == nil {
					slog.Warn("run-checks pass failed", "error", err)
				}
				select {
				case <-gctx.Done():
					return nil
				case <-ticker.C:
				}
			}
		})
	} else {
		slog.Info("in-process checks disabled; Cloud Scheduler calls POST /internal/jobs/run-checks")
	}
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

type runnerFunc func(context.Context) error

// flushAfterWrites publishes the outbox rows a write created before the
// request ends, while the instance still has CPU (S-14).
func flushAfterWrites(next http.Handler, flush func(context.Context)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		next.ServeHTTP(w, r)
		switch r.Method {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			return
		}
		if strings.HasPrefix(r.URL.Path, "/internal/") {
			return // run-checks flushes inside its own pass
		}
		ctx, cancel := context.WithTimeout(context.WithoutCancel(r.Context()), 10*time.Second)
		defer cancel()
		flush(ctx)
	})
}

func (f runnerFunc) RunOnce(ctx context.Context) error { return f(ctx) }
