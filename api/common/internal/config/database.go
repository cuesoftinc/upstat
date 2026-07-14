package config

import (
	"context"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log/slog"
	"os"
	"time"
)

type DB struct {
	Client *mongo.Client
}

func NewDBHandler() *DB {
	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		slog.Error("MONGO_URI is required")
		os.Exit(1)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(mongoURI))
	if err != nil {
		slog.Error("mongo client error", "error", err)
	}

	err = client.Ping(ctx, nil)
	if err != nil {
		slog.Error("failed to connect to MongoDB", "error", err)
		os.Exit(1)
	}
	slog.Info("connected to MongoDB")

	return &DB{Client: client}
}
