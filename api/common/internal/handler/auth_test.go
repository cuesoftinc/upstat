package handler

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"

	"github.com/cuesoftinc/upstat/api/common/internal/auth"
	"github.com/cuesoftinc/upstat/api/common/internal/cache"
	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/util"
)

const (
	webOrigin   = "https://upstat.example.com"
	otherOrigin = "http://localhost:3000"
	validToken  = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
	verifier    = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
)

type fakeGoogle struct {
	identity *auth.GoogleIdentity
	err      error
	gotCode  string
	gotVer   string
}

func (f *fakeGoogle) AuthorizeURL(state, challenge string) string {
	return "https://accounts.example.com/auth?state=" + state + "&code_challenge=" + challenge
}

func (f *fakeGoogle) ExchangeCode(_ context.Context, code, v string) (*auth.GoogleIdentity, error) {
	f.gotCode, f.gotVer = code, v
	return f.identity, f.err
}

type fakeHandoffs struct {
	createErr error
	redeemErr error
	token     string
	created   []string
	redeemed  []string
}

func (f *fakeHandoffs) Create(_ context.Context, userID, email, name, challenge string) (string, string, error) {
	f.created = append(f.created, userID+"|"+email+"|"+name+"|"+challenge)
	return validToken, "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", f.createErr
}

func (f *fakeHandoffs) Redeem(_ context.Context, channel, code, v string) (string, error) {
	f.redeemed = append(f.redeemed, channel+"|"+code+"|"+v)
	return f.token, f.redeemErr
}

type fakeUsers struct {
	byEmail   map[string]*model.User
	createErr error
	creates   int
}

func (f *fakeUsers) GetUser(email string) (*model.User, error) {
	if u, ok := f.byEmail[email]; ok {
		return u, nil
	}
	return nil, mongo.ErrNoDocuments
}

func (f *fakeUsers) CreateUser(u model.User) (*mongo.InsertOneResult, error) {
	if f.createErr != nil {
		return nil, f.createErr
	}
	f.creates++
	u.Id = primitive.NewObjectID()
	f.byEmail[u.Email] = &u
	return &mongo.InsertOneResult{}, nil
}

type harness struct {
	h       *AuthHandler
	store   *cache.MemoryStore
	google  *fakeGoogle
	handoff *fakeHandoffs
	users   *fakeUsers
	mux     *http.ServeMux
}

func newHarness(t *testing.T, mutate ...func(*config.AuthConfig)) *harness {
	t.Helper()
	cfg := &config.AuthConfig{
		GoogleClientID:          "client",
		GoogleClientSecret:      "secret",
		GoogleRedirectURI:       "https://api.example.com/v1/auth/sso/google/callback",
		JWTAccessTTL:            time.Hour,
		SessionCookieName:       "sess",
		OAuthStateCookie:        "state",
		FrontendURL:             webOrigin + "/",
		AllowedOrigins:          []string{otherOrigin},
		Environment:             "production",
		SSOStartSourceRateLimit: 10,
		SSOStartGlobalRateLimit: 100,
		SSOStateSourceLimit:     10,
		SSOStateGlobalLimit:     100,
	}
	for _, m := range mutate {
		m(cfg)
	}
	hs := &harness{
		store:   cache.NewMemoryStore(),
		google:  &fakeGoogle{identity: &auth.GoogleIdentity{Subject: "sub", Email: "ada@example.com", Name: "Ada"}},
		handoff: &fakeHandoffs{token: "session-token"},
		users:   &fakeUsers{byEmail: map[string]*model.User{}},
		mux:     http.NewServeMux(),
	}
	hs.h = NewAuthHandler(cfg, hs.store, hs.google, hs.handoff, hs.users)
	hs.h.Register(hs.mux)
	return hs
}

func (hs *harness) do(req *http.Request) *httptest.ResponseRecorder {
	req.RemoteAddr = "203.0.113.9:4000"
	rec := httptest.NewRecorder()
	hs.mux.ServeHTTP(rec, req)
	return rec
}

func cookieNamed(rec *httptest.ResponseRecorder, name string) *http.Cookie {
	for _, c := range rec.Result().Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

func startLogin(t *testing.T, hs *harness, query string) (state string, rec *httptest.ResponseRecorder) {
	t.Helper()
	rec = hs.do(httptest.NewRequest(http.MethodGet, "/v1/auth/sso/google"+query, nil))
	if rec.Code != http.StatusTemporaryRedirect {
		t.Fatalf("start status = %d body=%s", rec.Code, rec.Body.String())
	}
	c := cookieNamed(rec, "state")
	if c == nil {
		t.Fatal("state cookie missing")
	}
	return c.Value, rec
}

func callbackRequest(state, query string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/v1/auth/sso/google/callback?state="+state+query, nil)
	req.AddCookie(&http.Cookie{Name: "state", Value: state})
	return req
}

func TestGoogleLoginRedirectsWithPKCEAndStateCookie(t *testing.T) {
	hs := newHarness(t)
	state, rec := startLogin(t, hs, "?cv="+validToken)

	loc, err := url.Parse(rec.Header().Get("Location"))
	if err != nil || loc.Query().Get("state") != state || loc.Query().Get("code_challenge") == "" {
		t.Fatalf("location = %q", rec.Header().Get("Location"))
	}
	c := cookieNamed(rec, "state")
	if !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteLaxMode || c.MaxAge != 600 || c.Path != "/" {
		t.Fatalf("state cookie = %+v", c)
	}
	if rec.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("start must not be cached")
	}
	var record ssoStateRecord
	if err := hs.store.Get(context.Background(), cache.SSOStateKey(state), &record); err != nil {
		t.Fatalf("state record: %v", err)
	}
	if record.Challenge != validToken || record.CodeVerifier == "" {
		t.Fatalf("record = %+v", record)
	}
}

func TestGoogleLoginDropsMalformedChallenge(t *testing.T) {
	hs := newHarness(t)
	state, _ := startLogin(t, hs, "?cv=short")
	var record ssoStateRecord
	if err := hs.store.Get(context.Background(), cache.SSOStateKey(state), &record); err != nil {
		t.Fatal(err)
	}
	if record.Challenge != "" {
		t.Fatalf("challenge kept: %q", record.Challenge)
	}
}

func TestGoogleLoginRejections(t *testing.T) {
	t.Run("unconfigured", func(t *testing.T) {
		hs := newHarness(t, func(c *config.AuthConfig) { c.GoogleClientSecret = "" })
		rec := hs.do(httptest.NewRequest(http.MethodGet, "/v1/auth/sso/google", nil))
		if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "sso_config_invalid") {
			t.Fatalf("got %d %s", rec.Code, rec.Body.String())
		}
	})
	t.Run("return_to outside allowlist", func(t *testing.T) {
		hs := newHarness(t)
		rec := hs.do(httptest.NewRequest(http.MethodGet, "/v1/auth/sso/google?return_to=https://evil.example", nil))
		if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), "return_to_not_allowed") {
			t.Fatalf("got %d %s", rec.Code, rec.Body.String())
		}
	})
	t.Run("rate limited", func(t *testing.T) {
		hs := newHarness(t, func(c *config.AuthConfig) { c.SSOStartSourceRateLimit = 1 })
		startLogin(t, hs, "")
		rec := hs.do(httptest.NewRequest(http.MethodGet, "/v1/auth/sso/google", nil))
		if rec.Code != http.StatusTooManyRequests || rec.Header().Get("Retry-After") != "60" ||
			!strings.Contains(rec.Body.String(), "rate_limited") {
			t.Fatalf("got %d %s", rec.Code, rec.Body.String())
		}
	})
	t.Run("browser navigation redirects to sign in", func(t *testing.T) {
		hs := newHarness(t, func(c *config.AuthConfig) { c.GoogleClientID = "" })
		req := httptest.NewRequest(http.MethodGet, "/v1/auth/sso/google", nil)
		req.Header.Set("Sec-Fetch-Dest", "document")
		rec := hs.do(req)
		loc := rec.Header().Get("Location")
		if rec.Code != http.StatusFound || !strings.HasPrefix(loc, webOrigin+"/signin?error=sso_config_invalid") {
			t.Fatalf("got %d %q", rec.Code, loc)
		}
	})
	t.Run("return_to allowed", func(t *testing.T) {
		hs := newHarness(t)
		state, _ := startLogin(t, hs, "?return_to="+url.QueryEscape(otherOrigin))
		var record ssoStateRecord
		if err := hs.store.Get(context.Background(), cache.SSOStateKey(state), &record); err != nil || record.ReturnTo != otherOrigin {
			t.Fatalf("record = %+v err=%v", record, err)
		}
	})
}

func TestGoogleCallbackIssuesHandoff(t *testing.T) {
	hs := newHarness(t)
	state, _ := startLogin(t, hs, "?cv="+validToken)

	rec := hs.do(callbackRequest(state, "&code=abc"))
	if rec.Code != http.StatusFound {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	if want := webOrigin + "/auth/callback?handoff=" + validToken; rec.Header().Get("Location") != want {
		t.Fatalf("location = %q", rec.Header().Get("Location"))
	}
	if hs.google.gotCode != "abc" || hs.google.gotVer == "" {
		t.Fatalf("google got %q %q", hs.google.gotCode, hs.google.gotVer)
	}
	if hs.users.creates != 1 || len(hs.handoff.created) != 1 ||
		!strings.HasSuffix(hs.handoff.created[0], "|ada@example.com|Ada|"+validToken) {
		t.Fatalf("created=%v creates=%d", hs.handoff.created, hs.users.creates)
	}
	if c := cookieNamed(rec, oauthHandoffCookie); c == nil || !c.HttpOnly || c.MaxAge != 300 || c.Value == validToken {
		t.Fatalf("handoff cookie = %+v", c)
	}
	if c := cookieNamed(rec, "state"); c == nil || c.MaxAge >= 0 {
		t.Fatalf("state cookie not cleared: %+v", c)
	}

	again := hs.do(callbackRequest(state, "&code=abc"))
	if !strings.Contains(again.Header().Get("Location"), "error=expired_state") {
		t.Fatalf("state must be single use: %q", again.Header().Get("Location"))
	}
}

func TestGoogleCallbackReusesExistingUser(t *testing.T) {
	hs := newHarness(t)
	id := primitive.NewObjectID()
	hs.users.byEmail["ada@example.com"] = &model.User{Id: id, Email: "ada@example.com", Name: "Existing"}
	state, _ := startLogin(t, hs, "")
	hs.do(callbackRequest(state, "&code=abc"))
	if hs.users.creates != 0 || !strings.HasPrefix(hs.handoff.created[0], id.Hex()+"|ada@example.com|Existing|") {
		t.Fatalf("created=%v creates=%d", hs.handoff.created, hs.users.creates)
	}
}

func TestGoogleCallbackNameFallsBackToEmail(t *testing.T) {
	hs := newHarness(t)
	hs.google.identity.Name = ""
	state, _ := startLogin(t, hs, "")
	hs.do(callbackRequest(state, "&code=abc"))
	if got := hs.users.byEmail["ada@example.com"].Name; got != "ada@example.com" {
		t.Fatalf("name = %q", got)
	}
}

func TestGoogleCallbackFailures(t *testing.T) {
	location := func(rec *httptest.ResponseRecorder) string { return rec.Header().Get("Location") }

	t.Run("missing state cookie", func(t *testing.T) {
		hs := newHarness(t)
		rec := hs.do(httptest.NewRequest(http.MethodGet, "/v1/auth/sso/google/callback?state=x&code=c", nil))
		if !strings.Contains(location(rec), "error=missing_state") {
			t.Fatalf("location = %q", location(rec))
		}
	})
	t.Run("state mismatch", func(t *testing.T) {
		hs := newHarness(t)
		req := httptest.NewRequest(http.MethodGet, "/v1/auth/sso/google/callback?state=a&code=c", nil)
		req.AddCookie(&http.Cookie{Name: "state", Value: "b"})
		if !strings.Contains(location(hs.do(req)), "error=invalid_state") {
			t.Fatal("want invalid_state")
		}
	})
	t.Run("provider denial", func(t *testing.T) {
		hs := newHarness(t)
		state, _ := startLogin(t, hs, "")
		rec := hs.do(callbackRequest(state, "&error=access_denied"))
		if !strings.Contains(location(rec), "error=access_denied") || hs.google.gotCode != "" {
			t.Fatalf("location = %q", location(rec))
		}
		if err := hs.store.Get(context.Background(), cache.SSOStateKey(state), &ssoStateRecord{}); !errors.Is(err, cache.ErrCacheMiss) {
			t.Fatalf("state must be consumed: %v", err)
		}
	})
	t.Run("other provider error is generic", func(t *testing.T) {
		hs := newHarness(t)
		state, _ := startLogin(t, hs, "")
		rec := hs.do(callbackRequest(state, "&error=server_error"))
		if !strings.Contains(location(rec), "error=oauth_failed") {
			t.Fatalf("location = %q", location(rec))
		}
	})
	t.Run("missing code", func(t *testing.T) {
		hs := newHarness(t)
		state, _ := startLogin(t, hs, "")
		if !strings.Contains(location(hs.do(callbackRequest(state, ""))), "error=missing_code") {
			t.Fatal("want missing_code")
		}
	})
	t.Run("google exchange fails", func(t *testing.T) {
		hs := newHarness(t)
		hs.google.err = errors.New("boom")
		state, _ := startLogin(t, hs, "")
		rec := hs.do(callbackRequest(state, "&code=abc"))
		if !strings.Contains(location(rec), "error=sso_failed") || len(hs.handoff.created) != 0 {
			t.Fatalf("location = %q", location(rec))
		}
	})
	t.Run("user creation fails", func(t *testing.T) {
		hs := newHarness(t)
		hs.users.createErr = errors.New("db down")
		state, _ := startLogin(t, hs, "")
		if !strings.Contains(location(hs.do(callbackRequest(state, "&code=abc"))), "error=sso_failed") {
			t.Fatal("want sso_failed")
		}
	})
	t.Run("handoff creation fails", func(t *testing.T) {
		hs := newHarness(t)
		hs.handoff.createErr = errors.New("db down")
		state, _ := startLogin(t, hs, "")
		if !strings.Contains(location(hs.do(callbackRequest(state, "&code=abc"))), "error=sso_failed") {
			t.Fatal("want sso_failed")
		}
	})
	t.Run("errors return to the starting origin", func(t *testing.T) {
		hs := newHarness(t)
		state, _ := startLogin(t, hs, "?return_to="+url.QueryEscape(otherOrigin))
		rec := hs.do(callbackRequest(state, "&error=access_denied"))
		if !strings.HasPrefix(location(rec), otherOrigin+"/signin?") {
			t.Fatalf("location = %q", location(rec))
		}
	})
}

func exchangeRequest_(body, contentType, origin string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, "/v1/auth/sso/exchange", strings.NewReader(body))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	return req
}

func validExchangeBody() string {
	return `{"handoff":"` + validToken + `","verifier":"` + verifier + `"}`
}

func TestExchangeBodyChannel(t *testing.T) {
	hs := newHarness(t)
	rec := hs.do(exchangeRequest_(validExchangeBody(), "application/json; charset=utf-8", webOrigin))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", rec.Code, rec.Body.String())
	}
	if hs.handoff.redeemed[0] != auth.HandoffChannelBody+"|"+validToken+"|"+verifier {
		t.Fatalf("redeemed = %v", hs.handoff.redeemed)
	}
	if !strings.Contains(rec.Body.String(), `"access_token":"session-token"`) {
		t.Fatalf("body = %s", rec.Body.String())
	}
	c := cookieNamed(rec, "sess")
	if c == nil || c.Value != "session-token" || !c.HttpOnly || !c.Secure || c.MaxAge != 3600 {
		t.Fatalf("session cookie = %+v", c)
	}
	if cleared := cookieNamed(rec, oauthHandoffCookie); cleared == nil || cleared.MaxAge >= 0 {
		t.Fatalf("handoff cookie not cleared: %+v", cleared)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != webOrigin || rec.Header().Get("Access-Control-Allow-Credentials") != "true" {
		t.Fatalf("cors headers = %v", rec.Header())
	}
}

func TestExchangeBodyValidation(t *testing.T) {
	cases := []struct {
		name, body, ct string
		status         int
		code           string
	}{
		{"wrong content type", validExchangeBody(), "text/plain", 400, "invalid_body"},
		{"form content type", validExchangeBody(), "application/x-www-form-urlencoded", 400, "invalid_body"},
		{"non utf8 charset", validExchangeBody(), "application/json; charset=latin1", 400, "invalid_body"},
		{"unknown field", `{"handoff":"` + validToken + `","verifier":"` + verifier + `","x":1}`, "application/json", 400, "invalid_body"},
		{"trailing data", validExchangeBody() + `{}`, "application/json", 400, "invalid_body"},
		{"short handoff", `{"handoff":"abc","verifier":"` + verifier + `"}`, "application/json", 400, "invalid_request"},
		{"short verifier", `{"handoff":"` + validToken + `","verifier":"abc"}`, "application/json", 400, "invalid_request"},
		{"too large", `{"handoff":"` + strings.Repeat("a", 5000) + `"}`, "application/json", 413, "request_too_large"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			hs := newHarness(t)
			rec := hs.do(exchangeRequest_(tc.body, tc.ct, ""))
			if rec.Code != tc.status || !strings.Contains(rec.Body.String(), tc.code) {
				t.Fatalf("got %d %s", rec.Code, rec.Body.String())
			}
			if len(hs.handoff.redeemed) != 0 {
				t.Fatal("must not redeem")
			}
		})
	}
}

func TestExchangeOriginRules(t *testing.T) {
	t.Run("body channel rejects unknown origin", func(t *testing.T) {
		hs := newHarness(t)
		rec := hs.do(exchangeRequest_(validExchangeBody(), "application/json", "https://evil.example"))
		if rec.Code != http.StatusUnauthorized || !strings.Contains(rec.Body.String(), "handoff_invalid") {
			t.Fatalf("got %d %s", rec.Code, rec.Body.String())
		}
	})
	t.Run("body channel accepts secondary origin", func(t *testing.T) {
		hs := newHarness(t)
		rec := hs.do(exchangeRequest_(validExchangeBody(), "application/json", otherOrigin))
		if rec.Code != http.StatusOK || rec.Header().Get("Access-Control-Allow-Origin") != otherOrigin {
			t.Fatalf("got %d headers=%v", rec.Code, rec.Header())
		}
	})
	t.Run("cookie channel from secondary origin needs the verifier", func(t *testing.T) {
		hs := newHarness(t)
		req := exchangeRequest_("", "", otherOrigin)
		req.AddCookie(&http.Cookie{Name: oauthHandoffCookie, Value: validToken})
		rec := hs.do(req)
		if rec.Code != http.StatusUnauthorized || !strings.Contains(rec.Body.String(), "handoff_verifier_required") {
			t.Fatalf("got %d %s", rec.Code, rec.Body.String())
		}
	})
	t.Run("cookie channel from unknown origin is opaque", func(t *testing.T) {
		hs := newHarness(t)
		req := exchangeRequest_("", "", "https://evil.example")
		req.AddCookie(&http.Cookie{Name: oauthHandoffCookie, Value: validToken})
		rec := hs.do(req)
		if !strings.Contains(rec.Body.String(), "handoff_invalid") {
			t.Fatalf("got %d %s", rec.Code, rec.Body.String())
		}
	})
	t.Run("cookie channel from the frontend redeems", func(t *testing.T) {
		hs := newHarness(t)
		req := exchangeRequest_("", "", webOrigin)
		req.AddCookie(&http.Cookie{Name: oauthHandoffCookie, Value: validToken})
		rec := hs.do(req)
		if rec.Code != http.StatusOK || hs.handoff.redeemed[0] != auth.HandoffChannelCookie+"|"+validToken+"|" {
			t.Fatalf("got %d redeemed=%v", rec.Code, hs.handoff.redeemed)
		}
	})
	t.Run("cookie channel cross-site is refused", func(t *testing.T) {
		hs := newHarness(t)
		req := exchangeRequest_("", "", webOrigin)
		req.Header.Set("Sec-Fetch-Site", "cross-site")
		req.AddCookie(&http.Cookie{Name: oauthHandoffCookie, Value: validToken})
		if rec := hs.do(req); rec.Code != http.StatusUnauthorized {
			t.Fatalf("got %d", rec.Code)
		}
	})
	t.Run("cookie channel without cookie", func(t *testing.T) {
		hs := newHarness(t)
		rec := hs.do(exchangeRequest_("", "", webOrigin))
		if rec.Code != http.StatusUnauthorized || !strings.Contains(rec.Body.String(), "handoff_invalid") {
			t.Fatalf("got %d %s", rec.Code, rec.Body.String())
		}
	})
}

func TestExchangeRedeemErrors(t *testing.T) {
	t.Run("invalid handoff", func(t *testing.T) {
		hs := newHarness(t)
		hs.handoff.redeemErr = auth.ErrHandoffInvalid
		rec := hs.do(exchangeRequest_(validExchangeBody(), "application/json", ""))
		if rec.Code != http.StatusUnauthorized || !strings.Contains(rec.Body.String(), "handoff_invalid") || cookieNamed(rec, "sess") != nil {
			t.Fatalf("got %d %s", rec.Code, rec.Body.String())
		}
	})
	t.Run("store failure", func(t *testing.T) {
		hs := newHarness(t)
		hs.handoff.redeemErr = errors.New("db down")
		rec := hs.do(exchangeRequest_(validExchangeBody(), "application/json", ""))
		if rec.Code != http.StatusServiceUnavailable || !strings.Contains(rec.Body.String(), "sso_unavailable") {
			t.Fatalf("got %d %s", rec.Code, rec.Body.String())
		}
	})
}

func TestLogout(t *testing.T) {
	logout := func(hs *harness, mutate func(*http.Request)) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/v1/auth/logout", nil)
		mutate(req)
		return hs.do(req)
	}
	t.Run("cookie from the frontend clears cookies", func(t *testing.T) {
		hs := newHarness(t)
		rec := logout(hs, func(r *http.Request) {
			r.Header.Set("Origin", webOrigin)
			r.AddCookie(&http.Cookie{Name: "sess", Value: "t"})
		})
		if rec.Code != http.StatusNoContent {
			t.Fatalf("status = %d", rec.Code)
		}
		if c := cookieNamed(rec, "sess"); c == nil || c.MaxAge >= 0 || c.Value != "" {
			t.Fatalf("session cookie = %+v", c)
		}
		if c := cookieNamed(rec, oauthHandoffCookie); c == nil || c.MaxAge >= 0 {
			t.Fatalf("handoff cookie = %+v", c)
		}
	})
	t.Run("cookie from another origin is a csrf attempt", func(t *testing.T) {
		hs := newHarness(t)
		rec := logout(hs, func(r *http.Request) {
			r.Header.Set("Origin", "https://evil.example")
			r.AddCookie(&http.Cookie{Name: "sess", Value: "t"})
		})
		if rec.Code != http.StatusForbidden || !strings.Contains(rec.Body.String(), "csrf_rejected") {
			t.Fatalf("got %d %s", rec.Code, rec.Body.String())
		}
	})
	t.Run("bearer needs no origin proof", func(t *testing.T) {
		hs := newHarness(t)
		rec := logout(hs, func(r *http.Request) { r.Header.Set("Authorization", "Bearer abc") })
		if rec.Code != http.StatusNoContent {
			t.Fatalf("status = %d", rec.Code)
		}
	})
	t.Run("no credentials and no origin is refused", func(t *testing.T) {
		hs := newHarness(t)
		if rec := logout(hs, func(*http.Request) {}); rec.Code != http.StatusForbidden {
			t.Fatalf("status = %d", rec.Code)
		}
	})
}

func TestCORSPreflight(t *testing.T) {
	hs := newHarness(t)
	req := httptest.NewRequest(http.MethodOptions, "/v1/auth/sso/exchange", nil)
	req.Header.Set("Origin", webOrigin)
	rec := hs.do(req)
	if rec.Code != http.StatusNoContent || rec.Header().Get("Access-Control-Allow-Origin") != webOrigin ||
		!strings.Contains(rec.Header().Get("Access-Control-Allow-Headers"), "Content-Type") {
		t.Fatalf("got %d %v", rec.Code, rec.Header())
	}

	req = httptest.NewRequest(http.MethodOptions, "/v1/auth/sso/exchange", nil)
	req.Header.Set("Origin", "https://evil.example")
	if rec := hs.do(req); rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("unknown origin must not be allowed")
	}
}

func TestMe(t *testing.T) {
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
	util.SetAccessTTL(time.Hour)
	util.ConfigureSession(util.SessionSettings{CookieName: "sess", AllowedOrigin: func(o string) bool { return o == webOrigin }})
	token, err := util.GenerateSessionToken("u1", "ada@example.com", "Ada")
	if err != nil {
		t.Fatal(err)
	}
	hs := newHarness(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rec := hs.do(req)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"email":"ada@example.com"`) {
		t.Fatalf("got %d %s", rec.Code, rec.Body.String())
	}

	if rec := hs.do(httptest.NewRequest(http.MethodGet, "/v1/auth/me", nil)); rec.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous status = %d", rec.Code)
	}
}

func TestValidators(t *testing.T) {
	if !isValidURLToken(validToken) || isValidURLToken(validToken+"A") || isValidURLToken(strings.Repeat("+", 43)) {
		t.Fatal("isValidURLToken")
	}
	if !isValidPKCEVerifier(strings.Repeat("a~._-", 9)) || isValidPKCEVerifier(strings.Repeat("a", 42)) ||
		isValidPKCEVerifier(strings.Repeat("a", 129)) || isValidPKCEVerifier(strings.Repeat("a", 42)+"=") {
		t.Fatal("isValidPKCEVerifier")
	}
}

func TestCookieChannelAllowed(t *testing.T) {
	hs := newHarness(t)
	cases := []struct {
		origin, site string
		want         bool
	}{
		{webOrigin, "", true},
		{webOrigin, "same-site", true},
		{webOrigin, "cross-site", false},
		{otherOrigin, "", false},
		{"", "same-origin", true},
		{"", "same-site", false},
		{"", "", false},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodPost, "/", nil)
		if tc.origin != "" {
			req.Header.Set("Origin", tc.origin)
		}
		if tc.site != "" {
			req.Header.Set("Sec-Fetch-Site", tc.site)
		}
		if got := hs.h.cookieChannelAllowed(req); got != tc.want {
			t.Errorf("origin=%q site=%q got %v want %v", tc.origin, tc.site, got, tc.want)
		}
	}
}
