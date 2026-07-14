package main

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/config"
	pb "github.com/cuesoftinc/upstat/api/common/internal/proto"
	"github.com/cuesoftinc/upstat/api/common/internal/service"
	"github.com/cuesoftinc/upstat/api/common/internal/util"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type healthResponse struct {
	Status string `json:"status"`
}

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))

	config.LoadEnv()

	db := config.NewDBHandler()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	worker := service.NewMonitorWorker(db)
	go worker.Start(ctx)

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(util.AuthenticateInterceptor),
	)
	pb.RegisterUserServiceServer(grpcServer, service.NewUserServiceServer(db))
	pb.RegisterMonitorServiceServer(grpcServer, service.NewMonitorServiceServer(db))
	reflection.Register(grpcServer)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthCheck)
	mux.HandleFunc("/ready", readyCheck)

	handler := h2c.NewHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.ProtoMajor == 2 && strings.HasPrefix(r.Header.Get("Content-Type"), "application/grpc") {
			grpcServer.ServeHTTP(w, r)
			return
		}

		mux.ServeHTTP(w, r)
	}), &http2.Server{})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	addr := ":" + port
	srv := &http.Server{Addr: addr, Handler: handler}

	go func() {
		slog.Info("server started (gRPC + HTTP)", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("could not start server", "error", err)
			os.Exit(1)
		}
	}()

	// Graceful shutdown on SIGINT/SIGTERM (ctx is cancelled by the signal,
	// which also stops the monitor worker).
	<-ctx.Done()
	slog.Info("shutting down server")
	grpcServer.GracefulStop()

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
