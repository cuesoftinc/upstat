package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"github.com/CuesoftCloud/upstat/config"
	pb "github.com/CuesoftCloud/upstat/proto"
	"github.com/CuesoftCloud/upstat/services"
	"github.com/CuesoftCloud/upstat/utils"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"
)

type healthResponse struct {
	Status string `json:"status"`
}

func main() {
	config.LoadEnv()

	db := config.NewDBHandler()

	ctx := context.Background()
	worker := services.NewMonitorWorker(db)
	go worker.Start(ctx)

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(utils.AuthenticateInterceptor),
	)
	pb.RegisterUserServiceServer(grpcServer, services.NewUserServiceServer(db))
	pb.RegisterMonitorServiceServer(grpcServer, services.NewMonitorServiceServer(db))
	reflection.Register(grpcServer)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", healthCheck)

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
	log.Printf("server started on %s (gRPC + HTTP health)", addr)
	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatal("could not start server:", err)
	}
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(healthResponse{Status: "up"})
}
