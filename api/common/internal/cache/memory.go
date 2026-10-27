package cache

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"
)

// memorySweepInterval bounds how often the whole map is scanned for expired entries.
const memorySweepInterval = time.Minute

// MemoryStore is the in-process TTL store for SSO state. Expired entries are purged lazily.
type MemoryStore struct {
	mu         sync.Mutex
	entries    map[string]memoryEntry
	ssoLimiter memorySSOLimiter
	lastSweep  time.Time
}

type memoryEntry struct {
	value     []byte
	expiresAt time.Time
}

// ErrCacheMiss reports an absent or expired key.
var ErrCacheMiss = errors.New("cache: miss")

// SSOStateKey is the store key for a pending SSO login state.
func SSOStateKey(state string) string {
	return fmt.Sprintf("auth:sso:state:%s", state)
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		entries: make(map[string]memoryEntry),
	}
}

// Set marshals v to JSON and stores it at key with an optional TTL.
func (m *MemoryStore) Set(ctx context.Context, key string, v any, ttl time.Duration) error {
	b, err := json.Marshal(v)
	if err != nil {
		return fmt.Errorf("cache: marshal: %w", err)
	}
	entry := memoryEntry{value: b}
	if ttl > 0 {
		entry.expiresAt = time.Now().Add(ttl)
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	m.maybeSweep(time.Now())
	m.entries[key] = entry
	return nil
}

// Get unmarshals the value at key into dst, returning ErrCacheMiss on a miss.
func (m *MemoryStore) Get(ctx context.Context, key string, dst any) error {
	m.mu.Lock()
	now := time.Now()
	m.maybeSweep(now)
	entry, ok := m.getLive(key, now)
	m.mu.Unlock()

	if !ok {
		return ErrCacheMiss
	}
	return json.Unmarshal(entry.value, dst)
}

// Take atomically reads and removes a value.
func (m *MemoryStore) Take(ctx context.Context, key string, dst any) error {
	m.mu.Lock()
	now := time.Now()
	m.maybeSweep(now)
	entry, ok := m.getLive(key, now)
	if ok {
		delete(m.entries, key)
	}
	m.mu.Unlock()

	if !ok {
		return ErrCacheMiss
	}
	return json.Unmarshal(entry.value, dst)
}

// Del removes one or more keys.
func (m *MemoryStore) Del(ctx context.Context, keys ...string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, k := range keys {
		delete(m.entries, k)
	}
	return nil
}

// getLive expires a stale entry in place; callers must hold mu.
func (m *MemoryStore) getLive(key string, now time.Time) (memoryEntry, bool) {
	entry, ok := m.entries[key]
	if !ok {
		return memoryEntry{}, false
	}
	if !entry.expiresAt.IsZero() && now.After(entry.expiresAt) {
		delete(m.entries, key)
		return memoryEntry{}, false
	}
	return entry, true
}

// maybeSweep scans for expired entries at most once per interval; callers must hold mu.
func (m *MemoryStore) maybeSweep(now time.Time) {
	if now.Sub(m.lastSweep) < memorySweepInterval {
		return
	}
	m.lastSweep = now
	for k, e := range m.entries {
		if !e.expiresAt.IsZero() && now.After(e.expiresAt) {
			delete(m.entries, k)
		}
	}
}
