package cache

import (
	"context"
	"errors"
	"fmt"
	"net"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/pkg/testenv"
)

// Two stores on one Valkey stand in for two instances of the service.
func twoInstances(t *testing.T) (*RedisStore, *RedisStore) {
	t.Helper()
	host, port, err := net.SplitHostPort(testenv.Require(t, "REDIS_TEST_ADDR"))
	if err != nil {
		t.Fatal(err)
	}
	prefix := fmt.Sprintf("upstat:test:%d:", time.Now().UnixNano())
	var stores [2]*RedisStore
	for i := range stores {
		client := NewRedisClient(RedisOptions{Host: host, Port: port})
		t.Cleanup(func() { _ = client.Close() })
		stores[i] = NewRedisStore(client, prefix)
	}
	return stores[0], stores[1]
}

func TestRedisStateIsSharedAndSingleUseAcrossInstances(t *testing.T) {
	a, b := twoInstances(t)
	ctx := context.Background()
	if err := a.Set(ctx, SSOStateKey("s1"), map[string]string{"verifier": "v"}, time.Minute); err != nil {
		t.Fatal(err)
	}
	var got map[string]string
	if err := b.Take(ctx, SSOStateKey("s1"), &got); err != nil || got["verifier"] != "v" {
		t.Fatalf("take on the other instance = %v, %v; want the state the first instance stored", got, err)
	}
	if err := a.Take(ctx, SSOStateKey("s1"), &got); !errors.Is(err, ErrCacheMiss) {
		t.Fatalf("second take = %v; want a miss: a state is single use", err)
	}
}

func TestRedisStateExpires(t *testing.T) {
	a, b := twoInstances(t)
	ctx := context.Background()
	if err := a.Set(ctx, "k", "v", 50*time.Millisecond); err != nil {
		t.Fatal(err)
	}
	time.Sleep(120 * time.Millisecond)
	var got string
	if err := b.Get(ctx, "k", &got); !errors.Is(err, ErrCacheMiss) {
		t.Fatalf("get after the ttl = %v; want a miss", err)
	}
}

func TestRedisStartLimitIsSharedAcrossInstances(t *testing.T) {
	a, b := twoInstances(t)
	ctx := context.Background()
	limits := SSOStartLimits{RateWindow: time.Minute, StateTTL: time.Minute, SourceRate: 2, GlobalRate: 10, SourcePending: 10, GlobalPending: 10}
	now := time.Now()
	for i, store := range []*RedisStore{a, b} {
		ok, err := store.AllowSSOStart(ctx, "src", fmt.Sprintf("r%d", i), now, limits)
		if err != nil || !ok {
			t.Fatalf("start %d = %v, %v; want allowed", i, ok, err)
		}
	}
	if ok, err := a.AllowSSOStart(ctx, "src", "r3", now, limits); err != nil || ok {
		t.Fatalf("third start = %v, %v; want limited by the starts made on both instances", ok, err)
	}
	if ok, _ := b.AllowSSOStart(ctx, "other", "r4", now, limits); !ok {
		t.Fatal("another source was limited by the first source's starts")
	}
}

func TestRedisReleaseFreesPendingCapacity(t *testing.T) {
	a, b := twoInstances(t)
	ctx := context.Background()
	limits := SSOStartLimits{RateWindow: time.Minute, StateTTL: time.Minute, SourceRate: 10, GlobalRate: 10, SourcePending: 1, GlobalPending: 10}
	now := time.Now()
	if ok, _ := a.AllowSSOStart(ctx, "src", "r1", now, limits); !ok {
		t.Fatal("first start refused")
	}
	if ok, _ := b.AllowSSOStart(ctx, "src", "r2", now, limits); ok {
		t.Fatal("a second pending start was allowed past the pending limit")
	}
	if err := a.ReleaseSSOStart(ctx, "src", "r1"); err != nil {
		t.Fatal(err)
	}
	if ok, _ := b.AllowSSOStart(ctx, "src", "r2", now, limits); !ok {
		t.Fatal("a released reservation did not free its pending slot")
	}
}
