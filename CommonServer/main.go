package main

import (
    "github.com/CuesoftCloud/upstat/config"
    pb "github.com/CuesoftCloud/upstat/proto"
    "github.com/CuesoftCloud/upstat/services"
    "github.com/CuesoftCloud/upstat/utils"
    "github.com/rs/cors"
    "google.golang.org/grpc"
    "log"
    "net/http"
    "sync"
)

var wg sync.WaitGroup

func main() {
    // Load environment variables
    config.LoadEnv()

    // Create gRPC server
    grpcServer := grpc.NewServer(
        grpc.UnaryInterceptor(utils.AuthenticateInterceptor),
    )
    service := &services.UserServiceServer{}

    // Register the service with the server
    pb.RegisterUserServiceServer(grpcServer, service)

    // Create CORS middleware
    corsMiddleware := cors.New(cors.Options{
        AllowedOrigins: []string{"*"},
    })

    // Set up HTTP/2 server
    server := &http.Server{
        Addr:    ":8080", // Set the desired port for both gRPC and HTTP
        Handler: corsMiddleware.Handler(grpcServer), // Use the gRPC server as the handler
    }

    wg.Add(1)

    // Start the server
    go func() {
        defer wg.Done()
        err := server.ListenAndServe()
        if err != nil {
            log.Fatal("could not start server")
        }
    }()

    log.Println("gRPC and HTTP servers started")

    // Wait for the server to start before exiting
    wg.Wait()
}