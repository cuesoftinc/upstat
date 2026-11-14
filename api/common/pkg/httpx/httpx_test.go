package httpx

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestJSONFallback(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ok", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte("hello"))
	})
	mux.HandleFunc("GET /v1/ok", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("GET /pattern", func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(r.Pattern))
	})
	fallback := JSONFallback(mux)

	t.Run("matched route passes through", func(t *testing.T) {
		rec := httptest.NewRecorder()
		fallback.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/ok", nil))
		if rec.Code != http.StatusCreated {
			t.Fatalf("status = %d, want 201", rec.Code)
		}
		if got := rec.Body.String(); got != "hello" {
			t.Errorf("body = %q, want %q", got, "hello")
		}
	})

	t.Run("matched route sees its pattern", func(t *testing.T) {
		rec := httptest.NewRecorder()
		fallback.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/pattern", nil))
		if got := rec.Body.String(); got != "GET /pattern" {
			t.Errorf("r.Pattern = %q, want %q", got, "GET /pattern")
		}
	})

	t.Run("server-wide OPTIONS keeps the mux 400", func(t *testing.T) {
		rec := httptest.NewRecorder()
		fallback.ServeHTTP(rec, httptest.NewRequest(http.MethodOptions, "*", nil))
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want 400", rec.Code)
		}
	})

	t.Run("unknown route uses the envelope", func(t *testing.T) {
		rec := httptest.NewRecorder()
		fallback.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/missing", nil))
		if rec.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want 404", rec.Code)
		}
		if got := rec.Header().Get("Content-Type"); got != "application/json" {
			t.Errorf("Content-Type = %q, want application/json", got)
		}
		want := `{"error":{"code":"not_found","message":"Not found","details":{}}}` + "\n"
		if got := rec.Body.String(); got != want {
			t.Errorf("body = %q, want %q", got, want)
		}
	})

	t.Run("wrong method keeps 405 and Allow", func(t *testing.T) {
		rec := httptest.NewRecorder()
		fallback.ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, "/ok", nil))
		if rec.Code != http.StatusMethodNotAllowed {
			t.Fatalf("status = %d, want 405", rec.Code)
		}
		if got := rec.Header().Get("Allow"); got != "GET, HEAD" {
			t.Errorf("Allow = %q, want %q", got, "GET, HEAD")
		}
		if got := rec.Header().Get("Content-Type"); got != "application/json" {
			t.Errorf("Content-Type = %q, want application/json", got)
		}
		want := `{"error":{"code":"method_not_allowed","message":"Method not allowed","details":{}}}` + "\n"
		if got := rec.Body.String(); got != want {
			t.Errorf("body = %q, want %q", got, want)
		}
	})

	t.Run("empty-pattern redirect is replayed", func(t *testing.T) {
		rec := httptest.NewRecorder()
		fallback.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/v1//missing", nil))
		if rec.Code != http.StatusTemporaryRedirect {
			t.Fatalf("status = %d, want 307", rec.Code)
		}
		if got := rec.Header().Get("Location"); got != "/v1/missing" {
			t.Errorf("Location = %q, want /v1/missing", got)
		}
		if got := rec.Body.String(); !strings.Contains(got, "/v1/missing") {
			t.Errorf("body = %q, want the replayed redirect body", got)
		}
	})
}
