package main

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/repository"
)

// flushTimeout bounds publishing and waking before a response.
const flushTimeout = 40 * time.Second

// batchPublisher is the slice of the outbox publisher a flush needs.
type batchPublisher interface {
	PublishBatch(ctx context.Context) (int, error)
}

// flushOutbox publishes batches until the outbox is empty; a failure leaves
// the rest for the next flush.
func flushOutbox(p batchPublisher) func(context.Context) {
	return func(ctx context.Context) {
		for {
			n, err := p.PublishBatch(ctx)
			if err != nil {
				slog.WarnContext(ctx, "outbox flush failed; the next pass retries", "error", err)
				return
			}
			if n == 0 {
				return
			}
		}
	}
}

// commitWriter runs before once, ahead of the response's first byte.
type commitWriter struct {
	http.ResponseWriter
	before func()
	done   bool
}

func (c *commitWriter) commit() {
	if !c.done {
		c.done = true
		c.before()
	}
}

func (c *commitWriter) WriteHeader(code int) {
	c.commit()
	c.ResponseWriter.WriteHeader(code)
}

func (c *commitWriter) Write(b []byte) (int, error) {
	c.commit()
	return c.ResponseWriter.Write(b)
}

func (c *commitWriter) Flush() {
	c.commit()
	if f, ok := c.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func (c *commitWriter) Unwrap() http.ResponseWriter { return c.ResponseWriter }

// flushBeforeResponse publishes the outbox rows a request created before the
// first byte of its response, while the instance still has CPU (S-14): after
// every write, and after a read that queued rows. run-checks flushes inside
// its own pass.
func flushBeforeResponse(next http.Handler, flush func(context.Context)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/internal/") {
			next.ServeHTTP(w, r)
			return
		}
		ctx, queued := repository.WithQueued(r.Context())
		r = r.WithContext(ctx)
		safe := r.Method == http.MethodGet || r.Method == http.MethodHead || r.Method == http.MethodOptions
		cw := &commitWriter{ResponseWriter: w, before: func() {
			if safe && !queued.Any() {
				return
			}
			fctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), flushTimeout)
			defer cancel()
			flush(fctx)
		}}
		next.ServeHTTP(cw, r)
		cw.commit()
	})
}

// pass is one run-checks pass: the checks, a retry of failed messages, then
// (on request-based CPU) the outbox flush and the settle of analytics.
type pass struct {
	checks   func(context.Context) error
	retry    func(context.Context)
	flush    func(context.Context)
	settle   func(context.Context) error
	caughtUp func(context.Context) error
	// settles is true on request-based CPU, where background work stalls.
	settles bool
}

func (p pass) run(ctx context.Context) error {
	err := p.checks(ctx)
	p.retry(ctx)
	if !p.settles {
		return err
	}
	p.flush(ctx)
	// Each pass settles analytics even when no result was sent, so its
	// nodata timers and rules tick (flows/monitor.md §2).
	if serr := p.settle(ctx); serr == nil {
		if werr := p.caughtUp(ctx); werr != nil {
			slog.WarnContext(ctx, "results not all handled; the next pass continues", "error", werr)
		}
	}
	return err
}
