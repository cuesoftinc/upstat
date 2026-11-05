package wake

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/pkg/gcpauth"
)

func TestWakeReturnsOnlyAfterEveryTargetAnswered(t *testing.T) {
	var answered atomic.Int32
	slow := func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(150 * time.Millisecond)
		answered.Add(1)
		w.WriteHeader(http.StatusOK)
	}
	a, b := httptest.NewServer(http.HandlerFunc(slow)), httptest.NewServer(http.HandlerFunc(slow))
	defer a.Close()
	defer b.Close()
	start := time.Now()
	New(gcpauth.New()).Wake(context.Background(), "test", a.URL, b.URL, "")
	if got := answered.Load(); got != 2 {
		t.Fatalf("Wake returned with %d of 2 targets answered; the caller would answer a request with work left", got)
	}
	if time.Since(start) > 140*time.Millisecond*2 {
		t.Fatal("Wake woke the targets one after another; want concurrent")
	}
}

func TestWakeDebouncesTheSameTarget(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
	}))
	defer srv.Close()
	w := New(gcpauth.New())
	w.Wake(context.Background(), "test", srv.URL, srv.URL)
	w.Wake(context.Background(), "test", srv.URL)
	if got := calls.Load(); got != 1 {
		t.Fatalf("calls = %d; want 1 within the debounce", got)
	}
}

func TestWakeAfterAFailedCallTriesAgain(t *testing.T) {
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		calls.Add(1)
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer srv.Close()
	w := New(gcpauth.New())
	w.Wake(context.Background(), "test", srv.URL)
	w.Wake(context.Background(), "test", srv.URL)
	if got := calls.Load(); got != 2 {
		t.Fatalf("calls = %d; want a failed wake not to be debounced", got)
	}
}
