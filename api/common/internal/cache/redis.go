package cache

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisStore keeps SSO state and the sign-in start limiter on the shared
// Valkey, so every instance of a scaled or restarted service sees the same
// pending logins and counters. Every key carries the configured prefix.
type RedisStore struct {
	client redis.Cmdable
	prefix string
}

// RedisOptions are the connection settings for the shared Valkey.
type RedisOptions struct {
	Host, Port, Username, Password string
	TLS                            bool
	DB                             int
}

// NewRedisClient dials the shared Valkey with short timeouts.
func NewRedisClient(o RedisOptions) *redis.Client {
	opts := &redis.Options{Addr: o.Host + ":" + o.Port, Username: o.Username, Password: o.Password, DB: o.DB,
		DialTimeout: 2 * time.Second, ReadTimeout: time.Second, WriteTimeout: time.Second}
	if o.TLS {
		opts.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
	}
	return redis.NewClient(opts)
}

// StateStore is what the sign-in handler needs: pending-state storage and
// the start limiter.
type StateStore interface {
	Set(ctx context.Context, key string, v any, ttl time.Duration) error
	Take(ctx context.Context, key string, dst any) error
	AllowSSOStart(ctx context.Context, sourceHash, reservationID string, now time.Time, limits SSOStartLimits) (bool, error)
	ReleaseSSOStart(ctx context.Context, sourceHash, reservationID string) error
}

// NewStateStore is the Valkey store when o is set, the per-process memory
// store otherwise (one instance only); the func releases the connection.
func NewStateStore(o *RedisOptions, prefix string) (StateStore, func() error) {
	if o == nil {
		return NewMemoryStore(), func() error { return nil }
	}
	client := NewRedisClient(*o)
	return NewRedisStore(client, prefix), client.Close
}

func NewRedisStore(client redis.Cmdable, prefix string) *RedisStore {
	return &RedisStore{client: client, prefix: prefix}
}

func (r *RedisStore) key(k string) string { return r.prefix + k }

// Set marshals v to JSON and stores it at key with an optional TTL.
func (r *RedisStore) Set(ctx context.Context, key string, v any, ttl time.Duration) error {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("cache: marshal: %w", err)
	}
	return r.client.Set(ctx, r.key(key), b, ttl).Err()
}

// Get unmarshals the value at key into dst, returning ErrCacheMiss on a miss.
func (r *RedisStore) Get(ctx context.Context, key string, dst any) error {
	b, err := r.client.Get(ctx, r.key(key)).Bytes()
	return decode(b, err, dst)
}

// Take atomically reads and removes a value, so a state is single use across instances.
func (r *RedisStore) Take(ctx context.Context, key string, dst any) error {
	b, err := r.client.GetDel(ctx, r.key(key)).Bytes()
	return decode(b, err, dst)
}

// Del removes one or more keys.
func (r *RedisStore) Del(ctx context.Context, keys ...string) error {
	full := make([]string, len(keys))
	for i, k := range keys {
		full[i] = r.key(k)
	}
	return r.client.Del(ctx, full...).Err()
}

func decode(b []byte, err error, dst any) error {
	if errors.Is(err, redis.Nil) {
		return ErrCacheMiss
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(b, dst)
}

// allowScript reserves one sign-in start. KEYS: source rate, source pending,
// global rate, global pending (sorted sets scored by expiry, ms). ARGV: now,
// rate window, pending TTL, source rate, global rate, source pending, global
// pending, reservation id. It returns 1 when reserved, 0 when limited.
var allowScript = redis.NewScript(`
local now = tonumber(ARGV[1])
local rateTTL = tonumber(ARGV[2])
local pendingTTL = tonumber(ARGV[3])
for i = 1, 4 do
  redis.call('ZREMRANGEBYSCORE', KEYS[i], '-inf', now)
end
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[4]) or redis.call('ZCARD', KEYS[3]) >= tonumber(ARGV[5])
   or redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[6]) or redis.call('ZCARD', KEYS[4]) >= tonumber(ARGV[7]) then
  return 0
end
local id = ARGV[8]
redis.call('ZADD', KEYS[1], now + rateTTL, id)
redis.call('ZADD', KEYS[3], now + rateTTL, id)
redis.call('ZADD', KEYS[2], now + pendingTTL, id)
redis.call('ZADD', KEYS[4], now + pendingTTL, id)
local ttl = math.max(rateTTL, pendingTTL)
for i = 1, 4 do
  redis.call('PEXPIRE', KEYS[i], ttl)
end
return 1
`)

func (r *RedisStore) limiterKeys(source string) []string {
	// The shared {sso} tag keeps every key of one reservation in one cluster slot.
	base := r.prefix + "auth:sso:{sso}:"
	return []string{base + "rate:src:" + source, base + "pending:src:" + source, base + "rate:global", base + "pending:global"}
}

// AllowSSOStart reserves rate and pending-state capacity; unattributed sources share one bucket.
func (r *RedisStore) AllowSSOStart(ctx context.Context, sourceHash, reservationID string, now time.Time, limits SSOStartLimits) (bool, error) {
	if err := limits.validate(); err != nil {
		return false, err
	}
	n, err := allowScript.Run(ctx, r.client, r.limiterKeys(sourceBucket(sourceHash)),
		now.UnixMilli(), limits.RateWindow.Milliseconds(), limits.StateTTL.Milliseconds(),
		limits.SourceRate, limits.GlobalRate, limits.SourcePending, limits.GlobalPending, reservationID).Int()
	if err != nil {
		return false, err
	}
	return n == 1, nil
}

// ReleaseSSOStart frees pending-state capacity without resetting the rate window.
func (r *RedisStore) ReleaseSSOStart(ctx context.Context, sourceHash, reservationID string) error {
	keys := r.limiterKeys(sourceBucket(sourceHash))
	pipe := r.client.TxPipeline()
	pipe.ZRem(ctx, keys[1], reservationID)
	pipe.ZRem(ctx, keys[3], reservationID)
	_, err := pipe.Exec(ctx)
	return err
}
