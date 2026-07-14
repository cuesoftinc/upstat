package config

import (
	"github.com/joho/godotenv"
	"log/slog"
)

func LoadEnv() {
	if err := godotenv.Load(); err != nil {
		slog.Warn("no .env file found; using environment variables")
	}
}
