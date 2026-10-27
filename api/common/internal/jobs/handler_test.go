package jobs

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

type fakeVerifier struct {
	claims *Claims
	err    error
	gotAud string
}

func (f *fakeVerifier) Verify(_ context.Context, _ string, audience string) (*Claims, error) {
	f.gotAud = audience
	return f.claims, f.err
}

type fakeRunner struct {
	calls int
	err   error
}

func (f *fakeRunner) RunOnce(context.Context) error {
	f.calls++
	return f.err
}

const invoker = "scheduler@example.iam.gserviceaccount.com"

func setEnv(t *testing.T) {
	t.Helper()
	t.Setenv("SCHEDULER_AUDIENCE", "https://common.example/")
	t.Setenv("SCHEDULER_INVOKER_EMAIL", invoker)
}

func do(h http.Handler, method, path, auth string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestGuard(t *testing.T) {
	good := &Claims{Email: invoker, EmailVerified: true}
	cases := []struct {
		name     string
		env      bool
		auth     string
		verifier *fakeVerifier
		want     int
	}{
		{"unconfigured", false, "Bearer t", &fakeVerifier{claims: good}, http.StatusServiceUnavailable},
		{"missing token", true, "", &fakeVerifier{claims: good}, http.StatusUnauthorized},
		{"not bearer", true, "Basic t", &fakeVerifier{claims: good}, http.StatusUnauthorized},
		{"bad token", true, "Bearer t", &fakeVerifier{err: errors.New("bad")}, http.StatusUnauthorized},
		{"wrong email", true, "Bearer t", &fakeVerifier{claims: &Claims{Email: "x@example.com", EmailVerified: true}}, http.StatusForbidden},
		{"unverified email", true, "Bearer t", &fakeVerifier{claims: &Claims{Email: invoker}}, http.StatusForbidden},
		{"ok", true, "Bearer t", &fakeVerifier{claims: good}, http.StatusOK},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.env {
				setEnv(t)
			}
			runner := &fakeRunner{}
			rec := do(Handler{Verifier: tc.verifier, Checks: runner}, http.MethodPost, Path+RunChecksJob, tc.auth)
			if rec.Code != tc.want {
				t.Fatalf("status = %d, want %d", rec.Code, tc.want)
			}
			if (runner.calls == 1) != (tc.want == http.StatusOK) {
				t.Fatalf("runner calls = %d for status %d", runner.calls, rec.Code)
			}
		})
	}
}

func TestGuardTrimsAudience(t *testing.T) {
	setEnv(t)
	v := &fakeVerifier{claims: &Claims{Email: invoker, EmailVerified: true}}
	do(Handler{Verifier: v, Checks: &fakeRunner{}}, http.MethodPost, Path+RunChecksJob, "Bearer t")
	if v.gotAud != "https://common.example" {
		t.Fatalf("audience = %q", v.gotAud)
	}
}

func TestRoute(t *testing.T) {
	setEnv(t)
	v := &fakeVerifier{claims: &Claims{Email: invoker, EmailVerified: true}}

	t.Run("unknown job is 404", func(t *testing.T) {
		runner := &fakeRunner{}
		rec := do(Handler{Verifier: v, Checks: runner}, http.MethodPost, Path+"other", "Bearer t")
		if rec.Code != http.StatusNotFound || runner.calls != 0 {
			t.Fatalf("status = %d, calls = %d", rec.Code, runner.calls)
		}
	})

	t.Run("get is 405", func(t *testing.T) {
		rec := do(Handler{Verifier: v, Checks: &fakeRunner{}}, http.MethodGet, Path+RunChecksJob, "Bearer t")
		if rec.Code != http.StatusMethodNotAllowed {
			t.Fatalf("status = %d", rec.Code)
		}
	})

	t.Run("run-checks is 200 with job and ms", func(t *testing.T) {
		runner := &fakeRunner{}
		rec := do(Handler{Verifier: v, Checks: runner}, http.MethodPost, Path+RunChecksJob, "Bearer t")
		if rec.Code != http.StatusOK || runner.calls != 1 {
			t.Fatalf("status = %d, calls = %d", rec.Code, runner.calls)
		}
		var body map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
			t.Fatal(err)
		}
		if body["job"] != RunChecksJob {
			t.Fatalf("job = %v", body["job"])
		}
		if _, ok := body["ms"]; !ok {
			t.Fatal("ms missing")
		}
	})

	t.Run("runner failure is 500", func(t *testing.T) {
		rec := do(Handler{Verifier: v, Checks: &fakeRunner{err: errors.New("boom")}}, http.MethodPost, Path+RunChecksJob, "Bearer t")
		if rec.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d", rec.Code)
		}
	})
}
