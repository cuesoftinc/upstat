package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/auth"
	"github.com/cuesoftinc/upstat/api/common/internal/cache"
	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/handler"
	"github.com/cuesoftinc/upstat/api/common/internal/jobs"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/internal/service"
	"github.com/cuesoftinc/upstat/api/common/internal/util"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
)

type healthResponse struct {
	Status string `json:"status"`
}

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	config.LoadEnv()

	authCfg, err := config.LoadAuth()
	if err != nil {
		slog.Error("invalid auth configuration", "error", err)
		os.Exit(1)
	}
	util.SetAccessTTL(authCfg.JWTAccessTTL)
	util.ConfigureSession(util.SessionSettings{
		CookieName:    authCfg.SessionCookieName,
		AllowedOrigin: authCfg.IsAllowedOrigin,
	})

	db := config.NewDBHandler()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	worker := service.NewMonitorWorker(db)
	if config.WorkerEnabled() {
		go worker.Start(ctx)
	} else {
		slog.Info("monitor worker loop disabled; checks run via POST /internal/jobs/run-checks")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthCheck)
	mux.HandleFunc("/ready", readyCheck)
	mux.Handle(jobs.Path, jobs.Handler{Verifier: jobs.GoogleVerifier{}, Checks: worker})

	handler.NewAuthHandler(
		authCfg,
		cache.NewMemoryStore(),
		auth.NewGoogleSSO(authCfg.GoogleClientID, authCfg.GoogleClientSecret, authCfg.GoogleRedirectURI),
		auth.NewHandoffService(repository.NewSSOHandoffRepository(db), authCfg.SessionSecret, util.GenerateSessionToken),
		repository.NewUserRepository(db),
	).Register(mux)

	handler.NewMonitorHandler(
		repository.NewMonitorRepository(db),
		repository.NewCheckResultRepository(db),
		repository.NewIncidentRepository(db),
		authCfg.IsAllowedOrigin,
	).Register(mux)

	root := h2c.NewHandler(mux, &http2.Server{})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	addr := ":" + port
	srv := &http.Server{Addr: addr, Handler: root}

	go func() {
		slog.Info("server started", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("could not start server", "error", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown on SIGINT/SIGTERM (ctx is cancelled by the signal,
	// which also stops the monitor worker).
	<-ctx.Done()
	slog.Info("shutting down server")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		slog.Error("forced shutdown", "error", err)
		os.Exit(1)
	}
	slog.Info("server exited")
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(healthResponse{Status: "up"})
}

func readyCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(healthResponse{Status: "ready"})
}
