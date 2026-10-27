package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestPKCEChallengeS256MatchesRFCVector(t *testing.T) {
	got := PKCEChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
	if got != "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM" {
		t.Fatalf("challenge = %q", got)
	}
}

func TestAuthorizeURLCarriesPKCEAndEscapesValues(t *testing.T) {
	g := NewGoogleSSO("client id", "secret", "http://localhost:8080/v1/auth/sso/google/callback")
	u, err := url.Parse(g.AuthorizeURL("state&x=1", "challenge"))
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	if q.Get("client_id") != "client id" || q.Get("state") != "state&x=1" {
		t.Fatalf("unescaped values: %v", q)
	}
	if q.Get("code_challenge") != "challenge" || q.Get("code_challenge_method") != "S256" {
		t.Fatalf("missing PKCE: %v", q)
	}
	if q.Get("response_type") != "code" || q.Get("scope") != googleScope {
		t.Fatalf("bad flow params: %v", q)
	}
}

func googleStub(t *testing.T, userInfo string) *GoogleSSO {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if r.PostForm.Get("code_verifier") != "verifier" || r.PostForm.Get("grant_type") != "authorization_code" {
			http.Error(w, `{"error":"invalid_grant"}`, http.StatusBadRequest)
			return
		}
		_, _ = w.Write([]byte(`{"access_token":"at"}`))
	})
	mux.HandleFunc("/userinfo", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer at" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(userInfo))
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	g := NewGoogleSSO("id", "secret", "http://localhost/cb")
	g.tokenURL = srv.URL + "/token"
	g.userInfoURL = srv.URL + "/userinfo"
	return g
}

func TestExchangeCodeReturnsNormalisedIdentity(t *testing.T) {
	g := googleStub(t, `{"sub":"123","email":" Ada@Example.com ","email_verified":true,"name":" Ada "}`)
	id, err := g.ExchangeCode(context.Background(), "code", "verifier")
	if err != nil {
		t.Fatal(err)
	}
	if id.Subject != "123" || id.Email != "ada@example.com" || id.Name != "Ada" {
		t.Fatalf("identity = %+v", id)
	}
}

func TestExchangeCodeRejectsBadVerifierAndUnverifiedEmail(t *testing.T) {
	g := googleStub(t, `{"sub":"123","email":"a@b.co","email_verified":false}`)
	if _, err := g.ExchangeCode(context.Background(), "code", "wrong"); err == nil {
		t.Fatal("expected token exchange failure")
	}
	if _, err := g.ExchangeCode(context.Background(), "code", "verifier"); err == nil {
		t.Fatal("expected unverified email rejection")
	}
}
