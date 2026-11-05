// Package wake starts a scaled-to-zero service so its Kafka consumers run
// (shared messaging contract, "Scale to zero"). Cloud Run starts an instance
// only for an HTTP request, so after publishing for a service we send it
// one: GET /health. The instance then consumes in the background until it
// has been idle long enough for Cloud Run to stop it.
//
// Waking is best-effort: a missed wake leaves the message in Kafka, and the
// every-minute run-checks pass settles the services again. Wake returns
// only after every target answered, so a request that publishes can answer
// after it without leaving work for CPU it no longer has.
//
// On request-based CPU (S-14) an instance gets CPU only while it serves a
// request, so a GET /health wake starts the instance but its consumers
// stall once the answer is sent. Settle is the wake that waits: a POST to
// /internal/settle that the target answers only after it has handled what
// is waiting for it.
package wake

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/cuesoftinc/upstat/api/common/pkg/gcpauth"
)

// debounce skips a wake when the same service was woken this recently: an
// instance that answered a request moments ago is still up.
const debounce = 10 * time.Second

// wakeTimeout bounds one wake call.
const wakeTimeout = 30 * time.Second

// settleTimeout covers a cold start, a consumer-group join and the
// target's own settle budget (analytics: 25 s).
const settleTimeout = 45 * time.Second

type Waker struct {
	client       *http.Client
	settleClient *http.Client
	signer       *gcpauth.Signer

	// Token, when set, goes in X-Internal-Token on Settle: the off-Cloud
	// Run guard (INTERNAL_TOKEN), as on the probe and api/query.
	Token string

	mu   sync.Mutex
	last map[string]time.Time
}

func New(signer *gcpauth.Signer) *Waker {
	return &Waker{client: &http.Client{Timeout: 30 * time.Second}, settleClient: &http.Client{}, signer: signer,
		last: map[string]time.Time{}}
}

// Wake wakes every base that is not debounced, concurrently, and returns
// when all have answered or wakeTimeout passed: a caller that answers a
// request afterwards still has CPU while the targets start. Empty bases
// (compose, Helm: the services always run) are skipped.
func (w *Waker) Wake(ctx context.Context, reason string, bases ...string) {
	var wg sync.WaitGroup
	seen := map[string]bool{}
	for _, base := range bases {
		if base == "" || seen[base] || !w.due(base) {
			continue
		}
		seen[base] = true
		wg.Add(1)
		go func() {
			defer wg.Done()
			cctx, cancel := context.WithTimeout(ctx, wakeTimeout)
			defer cancel()
			_ = w.Now(cctx, base, reason)
		}()
	}
	wg.Wait()
}

// Now wakes base and waits for the answer.
func (w *Waker) Now(ctx context.Context, base, reason string) error {
	if base == "" {
		return nil
	}
	base = strings.TrimRight(base, "/")
	err := w.call(ctx, base)
	if err != nil {
		w.forget(base)
		slog.Warn("wake failed", "step", "wake", "target", host(base), "reason", reason, "error", err)
		return err
	}
	slog.Info("woke service", "step", "wake", "target", host(base), "reason", reason)
	return nil
}

// Settle asks base to handle everything waiting for it and waits for the
// answer (POST /internal/settle, signed like a wake). Empty base: nothing
// to do (compose and Helm run every service all the time).
func (w *Waker) Settle(ctx context.Context, base, reason string) error {
	if base == "" {
		return nil
	}
	base = strings.TrimRight(base, "/")
	ctx, cancel := context.WithTimeout(ctx, settleTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, base+"/internal/settle", nil)
	if err != nil {
		return err
	}
	if err := w.signer.Sign(ctx, req, base); err != nil {
		return fmt.Errorf("id token: %w", err)
	}
	if w.Token != "" {
		req.Header.Set("X-Internal-Token", w.Token)
	}
	res, err := w.settleClient.Do(req)
	if err != nil {
		slog.Warn("settle failed", "step", "settle", "target", host(base), "reason", reason, "error", err)
		return err
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, res.Body)
	if res.StatusCode >= 300 {
		slog.Warn("settle failed", "step", "settle", "target", host(base), "reason", reason, "status", res.StatusCode)
		return fmt.Errorf("settle %s: status %d", host(base), res.StatusCode)
	}
	return nil
}

func (w *Waker) due(base string) bool {
	w.mu.Lock()
	defer w.mu.Unlock()
	if time.Since(w.last[base]) < debounce {
		return false
	}
	w.last[base] = time.Now()
	return true
}

func (w *Waker) forget(base string) {
	w.mu.Lock()
	defer w.mu.Unlock()
	delete(w.last, base)
}

func (w *Waker) call(ctx context.Context, base string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, base+"/health", nil)
	if err != nil {
		return err
	}
	if err := w.signer.Sign(ctx, req, base); err != nil {
		return fmt.Errorf("id token: %w", err)
	}
	res, err := w.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	_, _ = io.Copy(io.Discard, res.Body)
	if res.StatusCode >= 300 {
		return fmt.Errorf("status %d", res.StatusCode)
	}
	return nil
}

// host keeps logs readable: the service host, never a query string.
func host(base string) string {
	if u, err := url.Parse(base); err == nil && u.Host != "" {
		return u.Host
	}
	return base
}
