package cache

import (
	"context"
	"testing"
	"time"
)

func TestMemoryStoreSSOStartLimitsSourceAndGlobalCapacity(t *testing.T) {
	store := NewMemoryStore()
	now := time.Unix(1_700_000_000, 0)
	limits := SSOStartLimits{
		RateWindow:    time.Minute,
		StateTTL:      10 * time.Minute,
		SourceRate:    2,
		GlobalRate:    10,
		SourcePending: 3,
		GlobalPending: 3,
	}

	for i := 0; i < 2; i++ {
		allowed, err := store.AllowSSOStart(context.Background(), "source-a", string(rune('a'+i)), now, limits)
		if err != nil || !allowed {
			t.Fatalf("request %d allowed = %v, error = %v", i+1, allowed, err)
		}
	}
	allowed, err := store.AllowSSOStart(context.Background(), "source-a", "source-rate-limit", now, limits)
	if err != nil {
		t.Fatal(err)
	}
	if allowed {
		t.Fatal("expected per-source rate limit to reject the third request")
	}

	allowed, err = store.AllowSSOStart(context.Background(), "source-b", "global-third", now, limits)
	if err != nil || !allowed {
		t.Fatalf("third global reservation allowed = %v, error = %v", allowed, err)
	}
	allowed, err = store.AllowSSOStart(context.Background(), "source-c", "global-pending-limit", now, limits)
	if err != nil {
		t.Fatal(err)
	}
	if allowed {
		t.Fatal("expected global pending-state capacity to reject the fourth request")
	}

	if err := store.ReleaseSSOStart(context.Background(), "source-a", "a"); err != nil {
		t.Fatal(err)
	}
	allowed, err = store.AllowSSOStart(context.Background(), "source-c", "after-release", now, limits)
	if err != nil || !allowed {
		t.Fatalf("reservation after release allowed = %v, error = %v", allowed, err)
	}

	allowed, err = store.AllowSSOStart(
		context.Background(),
		"source-c",
		"after-expiry",
		now.Add(limits.StateTTL+time.Nanosecond),
		limits,
	)
	if err != nil || !allowed {
		t.Fatalf("reservation after expiry allowed = %v, error = %v", allowed, err)
	}
}

func TestSSOStartLimitsRejectInvalid(t *testing.T) {
	store := NewMemoryStore()
	if _, err := store.AllowSSOStart(context.Background(), "s", "id", time.Now(), SSOStartLimits{}); err == nil {
		t.Fatal("expected invalid limits error")
	}
}

func TestSSOStartUnattributedSourcesShareOneBucket(t *testing.T) {
	store := NewMemoryStore()
	now := time.Now()
	limits := SSOStartLimits{RateWindow: time.Minute, StateTTL: time.Minute, SourceRate: 1, GlobalRate: 10, SourcePending: 5, GlobalPending: 10}
	if ok, _ := store.AllowSSOStart(context.Background(), "", "a", now, limits); !ok {
		t.Fatal("first unattributed start rejected")
	}
	if ok, _ := store.AllowSSOStart(context.Background(), UnattributedSourceHash, "b", now, limits); ok {
		t.Fatal("second unattributed start should share the bucket")
	}
}
