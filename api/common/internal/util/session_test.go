package util

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const testJWTSecret = "0123456789abcdef0123456789abcdef"

func configureTestSession(t *testing.T) {
	t.Helper()
	t.Setenv("JWT_SECRET", testJWTSecret)
	prev := sessionSettings
	ConfigureSession(SessionSettings{
		CookieName:    "upstat_session",
		AllowedOrigin: func(origin string) bool { return origin == "http://localhost:3000" },
	})
	t.Cleanup(func() { sessionSettings = prev })
}

func TestSessionTokenRoundTripCarriesName(t *testing.T) {
	configureTestSession(t)
	tok, err := GenerateSessionToken("u1", "a@b.co", "Ada")
	if err != nil {
		t.Fatal(err)
	}
	claims, err := ValidateSessionToken(tok)
	if err != nil || claims.UserID != "u1" || claims.Email != "a@b.co" || claims.Name != "Ada" {
		t.Fatalf("claims = %+v, %v", claims, err)
	}
	id, email, err := ValidateToken(tok)
	if err != nil || id != "u1" || email != "a@b.co" {
		t.Fatalf("ValidateToken = %q %q %v", id, email, err)
	}
}

func TestSetAccessTTLControlsExpiry(t *testing.T) {
	configureTestSession(t)
	prev := accessTTL
	t.Cleanup(func() { accessTTL = prev })
	SetAccessTTL(-time.Hour)
	if accessTTL != prev {
		t.Fatal("non-positive TTL must be ignored")
	}
	accessTTL = -time.Minute
	tok, _ := GenerateSessionToken("u1", "a@b.co", "")
	if _, err := ValidateSessionToken(tok); err == nil {
		t.Fatal("expired token must fail")
	}
}

func TestValidateRejectsEmptySecret(t *testing.T) {
	configureTestSession(t)
	tok, _ := GenerateSessionToken("u1", "a@b.co", "")
	t.Setenv("JWT_SECRET", "")
	if _, err := ValidateSessionToken(tok); err == nil {
		t.Fatal("empty secret must fail closed")
	}
}

func TestAuthenticateHeaders(t *testing.T) {
	configureTestSession(t)
	tok, _ := GenerateSessionToken("u1", "a@b.co", "Ada")
	cookie := "other=1; upstat_session=" + tok

	cases := []struct {
		name                                     string
		authorization, cookie, origin, fetchSite string
		want                                     bool
	}{
		{"bearer", "Bearer " + tok, "", "", "", true},
		{"bad scheme", "Basic " + tok, "", "", "", false},
		{"bad bearer", "Bearer nope", "", "", "", false},
		{"cookie same origin", "", cookie, "http://localhost:3000", "same-site", true},
		{"cookie no origin", "", cookie, "", "", false},
		{"cookie foreign origin", "", cookie, "https://evil.example", "", false},
		{"cookie cross-site", "", cookie, "http://localhost:3000", "cross-site", false},
		{"nothing", "", "", "", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, ok := authenticateHeaders(tc.authorization, tc.cookie, tc.origin, tc.fetchSite)
			if ok != tc.want {
				t.Fatalf("ok = %v, want %v", ok, tc.want)
			}
		})
	}
}

func TestSessionMiddleware(t *testing.T) {
	configureTestSession(t)
	tok, _ := GenerateSessionToken("u1", "a@b.co", "Ada")
	h := SessionMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, _ := UserIDFromContext(r.Context())
		name, _ := NameFromContext(r.Context())
		_, _ = w.Write([]byte(id + ":" + name))
	}))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous = %d", rec.Code)
	}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK || rec.Body.String() != "u1:Ada" {
		t.Fatalf("authed = %d %q", rec.Code, rec.Body.String())
	}
}
