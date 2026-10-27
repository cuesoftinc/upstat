package cache

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestMemoryStoreTakeIsSingleUse(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	if err := store.Set(ctx, "k", map[string]string{"a": "b"}, time.Minute); err != nil {
		t.Fatal(err)
	}
	var got map[string]string
	if err := store.Take(ctx, "k", &got); err != nil || got["a"] != "b" {
		t.Fatalf("take = %v, %v", got, err)
	}
	if err := store.Take(ctx, "k", &got); !errors.Is(err, ErrCacheMiss) {
		t.Fatalf("second take error = %v", err)
	}
}

func TestMemoryStoreExpiry(t *testing.T) {
	store := NewMemoryStore()
	ctx := context.Background()
	if err := store.Set(ctx, "k", "v", time.Nanosecond); err != nil {
		t.Fatal(err)
	}
	time.Sleep(5 * time.Millisecond)
	var got string
	if err := store.Get(ctx, "k", &got); !errors.Is(err, ErrCacheMiss) {
		t.Fatalf("get error = %v", err)
	}
}

func TestSSOStateKey(t *testing.T) {
	if SSOStateKey("abc") != "auth:sso:state:abc" {
		t.Fatal("unexpected key")
	}
}
