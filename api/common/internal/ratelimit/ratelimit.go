// Package ratelimit is the per-user API limit on the shared Valkey
// (engineering.md §3; user upstat, keys upstat:*). It fails open: losing
// Valkey must never take the API down (§9.2).
package ratelimit

import (
	"context"
	"crypto/tls"
	"log/slog"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/cuesoftinc/upstat/api/common/internal/config"
)

type Limiter struct {
	client *redis.Client
	prefix string
}

// New returns nil when no Valkey is configured (limits off).
func New(cfg config.Redis) *Limiter {
	if cfg.Host == "" {
		return nil
	}
	opts := &redis.Options{Addr: cfg.Host + ":" + cfg.Port, Username: cfg.Username, Password: cfg.Password, DB: cfg.DB,
		DialTimeout: 2 * time.Second, ReadTimeout: time.Second, WriteTimeout: time.Second}
	if cfg.TLS {
		opts.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}
	return &Limiter{client: redis.NewClient(opts), prefix: cfg.Prefix}
}

// Allow counts one request in a fixed window keyed by key.
func (l *Limiter) Allow(ctx context.Context, key string, limit int, window time.Duration) (bool, time.Duration) {
	if l == nil {
		return true, 0
	}
	slot := time.Now().UnixNano() / int64(window)
	k := l.prefix + "rl:" + key + ":" + strconv.FormatInt(slot, 10)
	pipe := l.client.TxPipeline()
	incr := pipe.Incr(ctx, k)
	pipe.Expire(ctx, k, window)
	if _, err := pipe.Exec(ctx); err != nil {
		slog.WarnContext(ctx, "rate limiter unavailable; allowing", "error", err)
		return true, 0
	}
	if incr.Val() > int64(limit) {
		return false, time.Duration(int64(window) - time.Now().UnixNano()%int64(window))
	}
	return true, 0
}

func (l *Limiter) Close() error {
	if l == nil {
		return nil
	}
	return l.client.Close()
}
