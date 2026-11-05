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

	onCloudRun := config.OnCloudRun()

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
		ch := migrations.ClickHouse{URL: cfg.ClickHouseURL, User: cfg.ClickHouseUser, Password: cfg.ClickHousePassword,
			QueryUser: cfg.ClickHouseQueryUser}
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
	var redisOpts *cache.RedisOptions
	if cfg.Redis.Host != "" {
		redisOpts = &cache.RedisOptions{Host: cfg.Redis.Host, Port: cfg.Redis.Port, Username: cfg.Redis.Username,
			Password: cfg.Redis.Password, TLS: cfg.Redis.TLS, DB: cfg.Redis.DB}
	} else if onCloudRun {
		slog.Warn("REDIS_HOST is unset on Cloud Run: sign-in state and limits are per instance")
	}
	states, closeStates := cache.NewStateStore(redisOpts, cfg.Redis.Prefix)
	defer closeStates() //nolint:errcheck // shutdown

	waker := wake.New(signer)
	waker.Token = cfg.InternalToken
	publisher := &outbox.Publisher{DB: db, Producer: producer, Store: blobs, Interval: time.Second, Now: time.Now,
		Wake: func(ctx context.Context, event string) {
			switch event {
			case bus.EventConfigChanged:
				waker.Wake(ctx, event, cfg.Wake.Analytics, cfg.Wake.Observability, cfg.Wake.Query)
			default: // synthetics.result, verify_requested
				waker.Wake(ctx, event, cfg.Wake.Analytics)
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
	consumer.OnFailure(s.RecordFailure)

	// Cloud Run bills CPU per request (S-14): background work stalls once a
	// request is answered. So a write publishes its outbox rows before it
	// answers, and each run-checks pass settles analytics (it evaluates and
	// handles every result) and then waits until common has handled the
	// transitions analytics sent back. Compose and Helm run every service
	// all the time and leave WAKE_ANALYTICS_URL unset.
	settle := onCloudRun || cfg.Wake.Analytics != ""
	runChecks := runnerFunc(pass{
		checks: s.RunChecks,
		retry: func(ctx context.Context) {
			if _, err := s.RetryFailures(ctx, consumer.Replay); err != nil {
				slog.WarnContext(ctx, "retrying failed messages stopped; the next pass continues", "error", err)
			}
		},
		flush:    flushOutbox(publisher),
		settle:   func(ctx context.Context) error { return waker.Settle(ctx, cfg.Wake.Analytics, "run-checks") },
		caughtUp: func(ctx context.Context) error { return consumer.WaitCaughtUp(ctx, 20*time.Second) },
		settles:  settle,
	}.run)

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
	handler.NewAuthHandler(authCfg, states,
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
		app = flushBeforeResponse(mux, flushOutbox(publisher))
	}
	root := httpx.CORS(authCfg.IsAllowedOrigin, true, h2c.NewHandler(app, &http2.Server{}))
	srv := &http.Server{Addr: ":" + cfg.Port, Handler: root, ReadHeaderTimeout: 10 * time.Second}

	g, gctx := errgroup.WithContext(ctx)
	if !onCloudRun {
		// Request-based CPU stalls a background loop; Cloud Run publishes on
		// the request path and inside each run-checks pass.
		g.Go(func() error { publisher.Run(gctx); return nil })
	}
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

func (f runnerFunc) RunOnce(ctx context.Context) error { return f(ctx) }
