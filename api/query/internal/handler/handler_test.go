package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/pkg/httpx"
	"github.com/cuesoftinc/upstat/api/common/pkg/session"
	"github.com/cuesoftinc/upstat/api/common/pkg/snapshot"
	"github.com/cuesoftinc/upstat/api/common/pkg/store"
	"github.com/cuesoftinc/upstat/api/query/internal/telemetry"
)

type noRows struct{}

func (noRows) Rows(context.Context, string, string, map[string]string) ([]map[string]any, error) {
	return nil, nil
}

// TestErrorEnvelopeForFallbackAndUnauthorized covers the responses that
// bypass the handlers: the mux fallback (unknown route and wrong method) and
// the session middleware's rejection.
func TestErrorEnvelopeForFallbackAndUnauthorized(t *testing.T) {
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
	session.ConfigureSession(session.SessionSettings{CookieName: "sess"})
	mux := http.NewServeMux()
	New(nil, nil, Internal{}).Register(mux)
	fallback := httpx.JSONFallback(mux)

	cases := []struct {
		name, method, path string
		status             int
		body, allow        string
	}{
		{"unknown route", http.MethodGet, "/v1/no-such-route", http.StatusNotFound,
			`{"error":{"code":"not_found","message":"Not found","details":{}}}` + "\n", ""},
		{"anonymous", http.MethodGet, "/v1/services", http.StatusUnauthorized,
			`{"error":{"code":"unauthorized","message":"Authentication required","details":{}}}` + "\n", ""},
		{"wrong method", http.MethodDelete, "/v1/logs", http.StatusMethodNotAllowed,
			`{"error":{"code":"method_not_allowed","message":"Method not allowed","details":{}}}` + "\n", "GET"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			fallback.ServeHTTP(rec, httptest.NewRequest(tc.method, tc.path, nil))
			if rec.Code != tc.status {
				t.Fatalf("status = %d, want %d", rec.Code, tc.status)
			}
			if got := rec.Header().Get("Content-Type"); got != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", got)
			}
			if got := rec.Body.String(); got != tc.body {
				t.Errorf("body = %q, want %q", got, tc.body)
			}
			if tc.allow != "" && !strings.Contains(rec.Header().Get("Allow"), tc.allow) {
				t.Errorf("Allow = %q, want it to contain %q", rec.Header().Get("Allow"), tc.allow)
			}
		})
	}
}

func TestUptimeDaysParsing(t *testing.T) {
	if got, ok := uptimeDays("", false); !ok || got != telemetry.DefaultUptimeDays {
		t.Fatalf("omitted days = (%d, %v), want (%d, true)", got, ok, telemetry.DefaultUptimeDays)
	}
	valid := []struct {
		raw  string
		want int
	}{
		{"1", 1},
		{"400", telemetry.MaxUptimeDays},
		{"401", telemetry.MaxUptimeDays},
		{"999999999999", telemetry.MaxUptimeDays},
		{"999999999999999999999999999999", telemetry.MaxUptimeDays},
	}
	for _, tc := range valid {
		got, ok := uptimeDays(tc.raw, true)
		if !ok || got != tc.want {
			t.Errorf("uptimeDays(%q) = (%d, %v), want (%d, true)", tc.raw, got, ok, tc.want)
		}
	}
	for _, raw := range []string{"", "abc", "0", "-1", "-999999999999999999999999"} {
		if got, ok := uptimeDays(raw, true); ok {
			t.Errorf("uptimeDays(%q) = (%d, true), want invalid", raw, got)
		}
	}
}

// TestInternalUptimeDaysValidation pins the boundary contract for #409:
// malformed input is rejected, oversized input is clamped, and omitted input
// keeps the historical 90-day default.
func TestInternalUptimeDaysValidation(t *testing.T) {
	mux := http.NewServeMux()
	api := New(&telemetry.Service{CH: noRows{}, Now: func() time.Time { return time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC) }}, nil, Internal{Token: "internal-secret"})
	api.Register(mux)

	cases := []struct {
		name, query string
		status      int
		body        string
	}{
		{"omitted", "", http.StatusOK, "{}"},
		{"one day", "&days=1", http.StatusOK, "{}"},
		{"retention ceiling", "&days=400", http.StatusOK, "{}"},
		{"over ceiling", "&days=401", http.StatusOK, "{}"},
		{"huge", "&days=999999999999", http.StatusOK, "{}"},
		{"beyond uint64", "&days=999999999999999999999999999999", http.StatusOK, "{}"},
		{"explicit empty", "&days=", http.StatusBadRequest, "bad_shape"},
		{"malformed", "&days=abc", http.StatusBadRequest, "bad_shape"},
		{"zero", "&days=0", http.StatusBadRequest, "bad_shape"},
		{"negative", "&days=-1", http.StatusBadRequest, "bad_shape"},
		{"negative overflow", "&days=-999999999999999999999999", http.StatusBadRequest, "bad_shape"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/internal/v1/uptime?org_id=o1"+tc.query, nil)
			req.Header.Set("X-Internal-Token", "internal-secret")
			rec := httptest.NewRecorder()
			mux.ServeHTTP(rec, req)

			if rec.Code != tc.status {
				t.Fatalf("status = %d, want %d; body = %q", rec.Code, tc.status, rec.Body.String())
			}
			if !strings.Contains(rec.Body.String(), tc.body) {
				t.Errorf("body = %q, want it to contain %q", rec.Body.String(), tc.body)
			}
		})
	}
}

// TestRevokedAccessEndsWithinTheMaxAge proves a request re-reads the members
// snapshot once it is older than the max age, with no config event at all.
func TestRevokedAccessEndsWithinTheMaxAge(t *testing.T) {
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
	session.SetAccessTTL(time.Hour)
	session.ConfigureSession(session.SessionSettings{CookieName: "sess", AllowedOrigin: func(string) bool { return true }})
	token, err := session.GenerateSessionToken("u1", "ada@example.com", "Ada")
	if err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()
	blobs := store.NewMemory("p")
	clock := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	grant := snapshot.UserAccess{UserID: "u1", ActiveOrgID: "o1", Memberships: []snapshot.Membership{{OrgID: "o1", Role: "admin"}}}
	if _, err := snapshot.Write(ctx, blobs, snapshot.KindMembers, []snapshot.UserAccess{grant}, clock); err != nil {
		t.Fatal(err)
	}
	access := snapshot.NewAccess(blobs)
	access.SetClock(func() time.Time { return clock })
	if err := access.Load(ctx); err != nil {
		t.Fatal(err)
	}
	api := New(&telemetry.Service{CH: noRows{}, Now: func() time.Time { return clock }}, access, Internal{})
	api.AccessMaxAge = 30 * time.Second
	mux := http.NewServeMux()
	api.Register(mux)
	get := func() int {
		req := httptest.NewRequest(http.MethodGet, "/v1/services", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		return rec.Code
	}

	if code := get(); code != http.StatusOK {
		t.Fatalf("member status = %d", code)
	}
	if _, err := snapshot.Write(ctx, blobs, snapshot.KindMembers, []snapshot.UserAccess{{UserID: "u1"}}, clock.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	clock = clock.Add(10 * time.Second)
	if code := get(); code != http.StatusOK {
		t.Fatalf("inside the max age the cached grant still holds, got %d", code)
	}
	clock = clock.Add(30 * time.Second)
	if code := get(); code != http.StatusNotFound {
		t.Fatalf("past the max age a revoked member must lose access, got %d", code)
	}
}
