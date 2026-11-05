package wake

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/pkg/gcpauth"
)

func TestSettleWaitsForTheAnswer(t *testing.T) {
	var path, method string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path, method = r.URL.Path, r.Method
		time.Sleep(100 * time.Millisecond) // the target settles before it answers
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	w := New(gcpauth.New())
	start := time.Now()
	if err := w.Settle(context.Background(), srv.URL+"/", "test"); err != nil {
		t.Fatal(err)
	}
	if method != http.MethodPost || path != "/internal/settle" {
		t.Fatalf("called %s %s; want POST /internal/settle", method, path)
	}
	if time.Since(start) < 100*time.Millisecond {
		t.Fatal("Settle returned before the target answered")
	}
}

func TestSettleReportsAFailedTarget(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()
	if err := New(gcpauth.New()).Settle(context.Background(), srv.URL, "test"); err == nil {
		t.Fatal("Settle on a 500 = nil; want an error")
	}
}

func TestSettleWithoutATargetDoesNothing(t *testing.T) {
	if err := New(gcpauth.New()).Settle(context.Background(), "", "test"); err != nil {
		t.Fatal(err)
	}
}
