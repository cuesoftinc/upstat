package config

import (
	"strings"
	"testing"
	"time"
)

const testSecret = "0123456789abcdef0123456789abcdef"

func setAuthEnv(t *testing.T) {
	t.Helper()
	t.Setenv("JWT_SECRET", testSecret)
	t.Setenv("SESSION_SECRET", testSecret)
	t.Setenv("JWT_ACCESS_TTL", "")
	t.Setenv("JWT_EXPIRY_HOURS", "")
	t.Setenv("CORS_ORIGINS", "")
	t.Setenv("TRUST_PROXY_HEADERS", "")
	t.Setenv("TRUSTED_PROXY_CIDRS", "")
	t.Setenv("TRUSTED_PROXY_HOPS", "")
}

func TestLoadAuthDefaults(t *testing.T) {
	setAuthEnv(t)
	cfg, err := LoadAuth()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.JWTAccessTTL != 24*time.Hour {
		t.Fatalf("ttl = %v", cfg.JWTAccessTTL)
	}
	if cfg.SessionCookieName != "upstat_session" || cfg.OAuthStateCookie != "upstat_oauth_state" {
		t.Fatalf("cookie names = %q %q", cfg.SessionCookieName, cfg.OAuthStateCookie)
	}
}

func TestAccessTTLPrecedence(t *testing.T) {
	setAuthEnv(t)
	t.Setenv("JWT_EXPIRY_HOURS", "3")
	cfg, err := LoadAuth()
	if err != nil || cfg.JWTAccessTTL != 3*time.Hour {
		t.Fatalf("hours: %v %v", cfg, err)
	}
	t.Setenv("JWT_ACCESS_TTL", "15m")
	cfg, err = LoadAuth()
	if err != nil || cfg.JWTAccessTTL != 15*time.Minute {
		t.Fatalf("ttl: %v %v", cfg, err)
	}
	t.Setenv("JWT_ACCESS_TTL", "-1s")
	if _, err := LoadAuth(); err == nil {
		t.Fatal("negative ttl accepted")
	}
}

func TestLoadAuthRejectsWeakSecrets(t *testing.T) {
	setAuthEnv(t)
	t.Setenv("JWT_SECRET", "short")
	if _, err := LoadAuth(); err == nil || !strings.Contains(err.Error(), "JWT_SECRET") {
		t.Fatalf("err = %v", err)
	}
	setAuthEnv(t)
	t.Setenv("SESSION_SECRET", "")
	if _, err := LoadAuth(); err == nil || !strings.Contains(err.Error(), "SESSION_SECRET") {
		t.Fatalf("err = %v", err)
	}
}

func TestTrustProxyNeedsBoundary(t *testing.T) {
	setAuthEnv(t)
	t.Setenv("TRUST_PROXY_HEADERS", "true")
	if _, err := LoadAuth(); err == nil {
		t.Fatal("trust without boundary accepted")
	}
	t.Setenv("TRUSTED_PROXY_HOPS", "1")
	if _, err := LoadAuth(); err != nil {
		t.Fatal(err)
	}
}

func TestOriginAllowlist(t *testing.T) {
	setAuthEnv(t)
	t.Setenv("WEB_URL", "https://app.example.com:443")
	t.Setenv("CORS_ORIGINS", "http://localhost:3000,*")
	cfg, err := LoadAuth()
	if err != nil {
		t.Fatal(err)
	}
	for origin, want := range map[string]bool{
		"https://app.example.com": true,
		"http://localhost:3000":   true,
		"*":                       false,
		"https://evil.example":    false,
		"":                        false,
	} {
		if got := cfg.IsAllowedOrigin(origin); got != want {
			t.Errorf("IsAllowedOrigin(%q) = %v", origin, got)
		}
	}
	if !cfg.IsAllowedRedirectURL("http://localhost:3000/path") || cfg.IsAllowedRedirectURL("http://localhost:4000") {
		t.Fatal("redirect allowlist wrong")
	}
}
