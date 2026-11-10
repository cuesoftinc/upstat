package httpx

import (
	"net/http"
	"net/http/httptest"
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
}
