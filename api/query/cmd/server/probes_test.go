package main

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

type probeSpies struct {
	pings        int
	runningCalls int
	pingErr      error
	running      bool
}

func (s *probeSpies) ping(context.Context) error {
	s.pings++
	return s.pingErr
}

func (s *probeSpies) runningFunc() bool {
	s.runningCalls++
	return s.running
}

func newProbeMux(s *probeSpies) *http.ServeMux {
	mux := http.NewServeMux()
	registerProbes(mux, s.ping, s.runningFunc)
	return mux
}

func TestHealthDoesNotProbeDependencies(t *testing.T) {
	s := &probeSpies{pingErr: errors.New("store away")}
	res := httptest.NewRecorder()
	newProbeMux(s).ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/health", nil))

	if res.Code != http.StatusOK {
		t.Fatalf("status = %d; want 200", res.Code)
	}
	if got := res.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q; want application/json", got)
	}
	assertStatusBody(t, res.Body.Bytes(), "up")
	if s.pings != 0 || s.runningCalls != 0 {
		t.Errorf("pings = %d, running calls = %d; want 0 and 0", s.pings, s.runningCalls)
	}
}

func TestHealthRejectsNonGetMethods(t *testing.T) {
	res := httptest.NewRecorder()
	newProbeMux(&probeSpies{}).ServeHTTP(res, httptest.NewRequest(http.MethodPost, "/health", nil))

	if res.Code != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d; want 405", res.Code)
	}
	if got := res.Header().Get("Allow"); got != "GET, HEAD" {
		t.Errorf("Allow = %q; want GET, HEAD", got)
	}
}

func TestReadyProbesDependencies(t *testing.T) {
	s := &probeSpies{running: true}
	res := httptest.NewRecorder()
	newProbeMux(s).ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/ready", nil))

	if res.Code != http.StatusOK {
		t.Fatalf("status = %d; want 200", res.Code)
	}
	assertStatusBody(t, res.Body.Bytes(), "ready")
	if s.pings != 1 || s.runningCalls != 1 {
		t.Errorf("pings = %d, running calls = %d; want 1 and 1", s.pings, s.runningCalls)
	}
}

func TestReadyUnavailableWhenProbeFails(t *testing.T) {
	cases := []struct {
		name                   string
		pingErr                error
		running                bool
		wantPings, wantRunning int
	}{
		{"ping fails", errors.New("clickhouse away"), true, 1, 0},
		{"consumer stopped", nil, false, 1, 1},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			s := &probeSpies{pingErr: c.pingErr, running: c.running}
			res := httptest.NewRecorder()
			newProbeMux(s).ServeHTTP(res, httptest.NewRequest(http.MethodGet, "/ready", nil))

			if res.Code != http.StatusServiceUnavailable {
				t.Fatalf("status = %d; want 503", res.Code)
			}
			assertStatusBody(t, res.Body.Bytes(), "not ready")
			if s.pings != c.wantPings || s.runningCalls != c.wantRunning {
				t.Errorf("pings = %d, running calls = %d; want %d and %d",
					s.pings, s.runningCalls, c.wantPings, c.wantRunning)
			}
		})
	}
}

func assertStatusBody(t *testing.T, body []byte, want string) {
	t.Helper()
	var got map[string]string
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("body = %q: %v", body, err)
	}
	if len(got) != 1 || got["status"] != want {
		t.Errorf("body = %v; want {\"status\":%q}", got, want)
	}
}
