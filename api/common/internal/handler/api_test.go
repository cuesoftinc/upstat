package handler

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/cuesoftinc/upstat/api/common/pkg/session"
)

func TestMalformedIDsAreNotFound(t *testing.T) {
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
	session.SetAccessTTL(time.Hour)
	session.ConfigureSession(session.SessionSettings{CookieName: "sess", AllowedOrigin: func(string) bool { return true }})
	token, err := session.GenerateSessionToken("u1", "ada@example.com", "Ada")
	if err != nil {
		t.Fatal(err)
	}
	// The service is nil: a malformed id must be answered before any lookup.
	mux := http.NewServeMux()
	(&API{}).Register(mux)
	for _, path := range []string{
		"/v1/monitors/not-a-uuid", "/v1/incidents/1/timeline", "/v1/synthetics/x/runs/y",
		"/v1/monitors/00000000-0000-0000-0000-00000000000g",
	} {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		if rec.Code != http.StatusNotFound {
			t.Errorf("%s: status %d, want 404", path, rec.Code)
		}
	}
}

func TestPostgresMalformedValueIsNotFound(t *testing.T) {
	rec := httptest.NewRecorder()
	(&API{}).fail(rec, httptest.NewRequest(http.MethodGet, "/", nil), errors.Join(errors.New("lookup"), &pgconn.PgError{Code: "22P02"}))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status %d, want 404", rec.Code)
	}
}
