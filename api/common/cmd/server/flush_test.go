package main

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/repository"
)

// A write is answered only after its outbox rows are published: the client
// must not see a header while the flush is still running (S-14).
func TestResponseWaitsForTheFlush(t *testing.T) {
	release := make(chan struct{})
	flushing := make(chan struct{})
	var flushed atomic.Bool
	flush := func(context.Context) {
		close(flushing)
		<-release
		flushed.Store(true)
	}
	h := flushBeforeResponse(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(strings.Repeat("x", 1<<20)))
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
	}), flush)
	srv := httptest.NewServer(h)
	defer srv.Close()

	type result struct {
		res *http.Response
		err error
	}
	done := make(chan result, 1)
	go func() {
		res, err := http.Post(srv.URL+"/api/monitors", "application/json", strings.NewReader("{}"))
		done <- result{res, err}
	}()
	<-flushing
	select {
	case r := <-done:
		t.Fatalf("client got a response (%v, %v) while the outbox flush was still running", r.res, r.err)
	case <-time.After(200 * time.Millisecond):
	}
	close(release)
	r := <-done
	if r.err != nil {
		t.Fatal(r.err)
	}
	defer r.res.Body.Close()
	if !flushed.Load() {
		t.Fatal("response arrived before the flush finished")
	}
	body, _ := io.ReadAll(r.res.Body)
	if r.res.StatusCode != http.StatusCreated || len(body) != 1<<20 {
		t.Fatalf("response = %d with %d bytes; want 201 with the whole body", r.res.StatusCode, len(body))
	}
}

func TestFlushRunsPerRequestKind(t *testing.T) {
	cases := []struct {
		name, method, path string
		queue              bool
		want               int
	}{
		{"write", http.MethodPost, "/api/monitors", false, 1},
		{"patch", http.MethodPatch, "/api/monitors/1", false, 1},
		{"delete", http.MethodDelete, "/api/monitors/1", false, 1},
		{"plain read", http.MethodGet, "/api/monitors", false, 0},
		{"read that queued", http.MethodGet, "/api/monitors/1/verify", true, 1},
		{"options", http.MethodOptions, "/api/monitors", false, 0},
		{"internal write", http.MethodPost, "/internal/jobs/run-checks", false, 0},
		{"internal that queued", http.MethodPost, "/internal/settle", true, 0},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var n int
			h := flushBeforeResponse(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if c.queue {
					repository.NoteQueued(r.Context())
				}
				w.WriteHeader(http.StatusOK)
			}), func(context.Context) { n++ })
			h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(c.method, c.path, nil))
			if n != c.want {
				t.Fatalf("%s %s flushed %d times; want %d", c.method, c.path, n, c.want)
			}
		})
	}
}

// A handler that never writes still flushes before the empty answer.
func TestFlushRunsForAnEmptyAnswer(t *testing.T) {
	var n int
	h := flushBeforeResponse(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}), func(context.Context) { n++ })
	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, "/api/x", nil))
	if n != 1 {
		t.Fatalf("flushed %d times; want 1", n)
	}
}

type fakeBatches struct{ sizes []int }

func (f *fakeBatches) PublishBatch(context.Context) (int, error) {
	if len(f.sizes) == 0 {
		return 0, nil
	}
	n := f.sizes[0]
	f.sizes = f.sizes[1:]
	return n, nil
}

func TestFlushOutboxDrainsEveryBatch(t *testing.T) {
	f := &fakeBatches{sizes: []int{100, 100, 7}}
	flushOutbox(f)(context.Background())
	if len(f.sizes) != 0 {
		t.Fatalf("batches left = %v; want the outbox drained", f.sizes)
	}
}

type failingBatches struct{ calls int }

func (f *failingBatches) PublishBatch(context.Context) (int, error) {
	f.calls++
	return 0, errors.New("kafka away")
}

func TestFlushOutboxStopsOnAFailure(t *testing.T) {
	f := &failingBatches{}
	flushOutbox(f)(context.Background())
	if f.calls != 1 {
		t.Fatalf("calls = %d; want one attempt and no spin", f.calls)
	}
}

// Each run-checks pass publishes, settles and waits inside its own request.
func TestPassFlushesBeforeSettling(t *testing.T) {
	var order []string
	step := func(name string) func(context.Context) {
		return func(context.Context) { order = append(order, name) }
	}
	p := pass{
		checks:   func(context.Context) error { order = append(order, "checks"); return nil },
		retry:    step("retry"),
		flush:    step("flush"),
		settle:   func(context.Context) error { order = append(order, "settle"); return nil },
		caughtUp: func(context.Context) error { order = append(order, "caughtUp"); return nil },
		settles:  true,
	}
	if err := p.run(context.Background()); err != nil {
		t.Fatal(err)
	}
	want := "checks retry flush settle caughtUp"
	if got := strings.Join(order, " "); got != want {
		t.Fatalf("order = %q; want %q", got, want)
	}
}

func TestPassOffCloudRunOnlyChecksAndRetries(t *testing.T) {
	var order []string
	p := pass{
		checks:   func(context.Context) error { order = append(order, "checks"); return nil },
		retry:    func(context.Context) { order = append(order, "retry") },
		flush:    func(context.Context) { order = append(order, "flush") },
		settle:   func(context.Context) error { order = append(order, "settle"); return nil },
		caughtUp: func(context.Context) error { order = append(order, "caughtUp"); return nil },
	}
	_ = p.run(context.Background())
	if got := strings.Join(order, " "); got != "checks retry" {
		t.Fatalf("order = %q; want only checks and retry", got)
	}
}

func TestPassSettlesEvenWhenChecksFail(t *testing.T) {
	var settled bool
	p := pass{
		checks:   func(context.Context) error { return errors.New("probe down") },
		retry:    func(context.Context) {},
		flush:    func(context.Context) {},
		settle:   func(context.Context) error { settled = true; return nil },
		caughtUp: func(context.Context) error { return nil },
		settles:  true,
	}
	if err := p.run(context.Background()); err == nil {
		t.Fatal("pass error = nil; want the checks error returned")
	}
	if !settled {
		t.Fatal("a failed check skipped the settle; analytics' timers would stall")
	}
}
