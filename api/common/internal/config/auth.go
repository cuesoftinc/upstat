package config

import (
	"errors"
	"fmt"
	"net/netip"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

const (
	defaultAccessTTL = 24 * time.Hour
	minSecretLength  = 32
)

// AuthConfig holds the Google sign-in and session settings read from the environment.
type AuthConfig struct {
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURI  string
	JWTSecret          string
	JWTAccessTTL       time.Duration
	SessionSecret      string
	SessionCookieName  string
	OAuthStateCookie   string
	FrontendURL        string
	AllowedOrigins     []string
	Environment        string

	SSOStartSourceRateLimit int
	SSOStartGlobalRateLimit int
	SSOStateSourceLimit     int
	SSOStateGlobalLimit     int

	TrustProxyHeaders bool
	TrustedProxyCIDRs []netip.Prefix
	TrustedProxyHops  int
}

// LoadAuth reads the auth settings and fails when a required secret is missing or weak.
func LoadAuth() (*AuthConfig, error) {
	ttl, err := accessTTL()
	if err != nil {
		return nil, err
	}
	cidrs, err := parseCIDRs(os.Getenv("TRUSTED_PROXY_CIDRS"))
	if err != nil {
		return nil, fmt.Errorf("TRUSTED_PROXY_CIDRS: %w", err)
	}
	cfg := &AuthConfig{
		GoogleClientID:          strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_ID")),
		GoogleClientSecret:      strings.TrimSpace(os.Getenv("GOOGLE_CLIENT_SECRET")),
		GoogleRedirectURI:       envOr("GOOGLE_REDIRECT_URI", "http://localhost:8080/v1/auth/sso/google/callback"),
		JWTSecret:               os.Getenv("JWT_SECRET"),
		JWTAccessTTL:            ttl,
		SessionSecret:           os.Getenv("SESSION_SECRET"),
		SessionCookieName:       envOr("SESSION_COOKIE_NAME", "upstat_session"),
		OAuthStateCookie:        envOr("OAUTH_STATE_COOKIE", "upstat_oauth_state"),
		FrontendURL:             envOr("WEB_URL", "http://localhost:3000"),
		AllowedOrigins:          splitCSV(os.Getenv("CORS_ORIGINS")),
		Environment:             envOr("APP_ENV", "development"),
		SSOStartSourceRateLimit: envPositiveInt("SSO_START_SOURCE_RATE_LIMIT", 10),
		SSOStartGlobalRateLimit: envPositiveInt("SSO_START_GLOBAL_RATE_LIMIT", 300),
		SSOStateSourceLimit:     envPositiveInt("SSO_STATE_SOURCE_LIMIT", 20),
		SSOStateGlobalLimit:     envPositiveInt("SSO_STATE_GLOBAL_LIMIT", 2000),
		TrustProxyHeaders:       strings.EqualFold(os.Getenv("TRUST_PROXY_HEADERS"), "true"),
		TrustedProxyCIDRs:       cidrs,
		TrustedProxyHops:        envInt("TRUSTED_PROXY_HOPS", 0),
	}
	if err := cfg.validate(); err != nil {
		return nil, err
	}
	return cfg, nil
}

func (c *AuthConfig) validate() error {
	if len(c.JWTSecret) < minSecretLength {
		return fmt.Errorf("JWT_SECRET must be at least %d characters", minSecretLength)
	}
	if len(c.SessionSecret) < minSecretLength {
		return fmt.Errorf("SESSION_SECRET must be at least %d characters", minSecretLength)
	}
	if c.TrustedProxyHops < 0 {
		return errors.New("TRUSTED_PROXY_HOPS must not be negative")
	}
	if c.TrustProxyHeaders && len(c.TrustedProxyCIDRs) == 0 && c.TrustedProxyHops == 0 {
		return errors.New("TRUST_PROXY_HEADERS needs TRUSTED_PROXY_CIDRS or TRUSTED_PROXY_HOPS")
	}
	return nil
}

// GoogleConfigured reports whether every setting the Google flow needs is present.
func (c *AuthConfig) GoogleConfigured() bool {
	return c.GoogleClientID != "" && c.GoogleClientSecret != "" &&
		strings.TrimSpace(c.GoogleRedirectURI) != "" && strings.TrimSpace(c.FrontendURL) != ""
}

func (c *AuthConfig) IsDevelopment() bool {
	return strings.EqualFold(c.Environment, "development") || strings.EqualFold(c.Environment, "test")
}

// FrontendOrigin is WEB_URL as a browser serializes its origin, falling back to the raw value so comparisons fail closed.
func (c *AuthConfig) FrontendOrigin() string {
	if origin := originOf(c.FrontendURL); origin != "" {
		return origin
	}
	return c.FrontendURL
}

// CredentialedOrigins lists the origins that may send cookies: WEB_URL plus explicit CORS_ORIGINS entries, never a wildcard.
func (c *AuthConfig) CredentialedOrigins() []string {
	origins := make([]string, 0, len(c.AllowedOrigins)+1)
	seen := map[string]struct{}{}
	add := func(origin string) {
		if origin == "" {
			return
		}
		if _, dup := seen[origin]; dup {
			return
		}
		seen[origin] = struct{}{}
		origins = append(origins, origin)
	}
	add(originOf(c.FrontendURL))
	for _, allowed := range c.AllowedOrigins {
		if allowed == "*" {
			continue
		}
		add(originOf(allowed))
	}
	return origins
}

// IsAllowedOrigin reports whether origin is WEB_URL or an explicit CORS_ORIGINS entry.
func (c *AuthConfig) IsAllowedOrigin(origin string) bool {
	if origin == "" {
		return false
	}
	for _, allowed := range c.CredentialedOrigins() {
		if origin == allowed {
			return true
		}
	}
	return false
}

func (c *AuthConfig) IsAllowedRedirectURL(rawURL string) bool {
	return c.IsAllowedOrigin(originOf(rawURL))
}

func originOf(rawURL string) string {
	u, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || u.Scheme == "" || u.Host == "" {
		return ""
	}
	host := u.Host
	if port := u.Port(); (u.Scheme == "https" && port == "443") || (u.Scheme == "http" && port == "80") {
		host = strings.TrimSuffix(host, ":"+port)
	}
	return u.Scheme + "://" + host
}

// accessTTL prefers JWT_ACCESS_TTL, then JWT_EXPIRY_HOURS, then 24 hours.
func accessTTL() (time.Duration, error) {
	if raw := strings.TrimSpace(os.Getenv("JWT_ACCESS_TTL")); raw != "" {
		ttl, err := time.ParseDuration(raw)
		if err != nil || ttl <= 0 {
			return 0, fmt.Errorf("JWT_ACCESS_TTL must be a positive duration, got %q", raw)
		}
		return ttl, nil
	}
	if raw := strings.TrimSpace(os.Getenv("JWT_EXPIRY_HOURS")); raw != "" {
		hours, err := strconv.Atoi(raw)
		if err != nil || hours <= 0 {
			return 0, fmt.Errorf("JWT_EXPIRY_HOURS must be a positive integer, got %q", raw)
		}
		return time.Duration(hours) * time.Hour, nil
	}
	return defaultAccessTTL, nil
}

func envOr(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	if v, err := strconv.Atoi(strings.TrimSpace(os.Getenv(key))); err == nil {
		return v
	}
	return fallback
}

func envPositiveInt(key string, fallback int) int {
	if v := envInt(key, fallback); v > 0 {
		return v
	}
	return fallback
}

func splitCSV(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

func parseCIDRs(raw string) ([]netip.Prefix, error) {
	values := splitCSV(raw)
	prefixes := make([]netip.Prefix, 0, len(values))
	for _, value := range values {
		prefix, err := netip.ParsePrefix(value)
		if err != nil {
			return nil, fmt.Errorf("invalid CIDR %q", value)
		}
		prefixes = append(prefixes, prefix.Masked())
	}
	return prefixes, nil
}
