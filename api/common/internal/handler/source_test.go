package handler

import (
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"

	"github.com/cuesoftinc/upstat/api/common/internal/cache"
	"github.com/cuesoftinc/upstat/api/common/internal/config"
)

func sourceRequest(remote string, xff ...string) *http.Request {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = remote
	for _, v := range xff {
		r.Header.Add("X-Forwarded-For", v)
	}
	return r
}

func TestRequestSourceIP(t *testing.T) {
	proxy := netip.MustParsePrefix("10.0.0.0/8")
	cases := []struct {
		name string
		cfg  config.AuthConfig
		req  *http.Request
		want string
		ok   bool
	}{
		{"peer when proxies untrusted", config.AuthConfig{}, sourceRequest("203.0.113.9:1234", "198.51.100.1"), "203.0.113.9", true},
		{"unparseable peer", config.AuthConfig{}, sourceRequest("garbage"), "", false},
		{"v4 in v6 folds", config.AuthConfig{}, sourceRequest("[::ffff:203.0.113.9]:80"), "203.0.113.9", true},
		{"cidr proxy forwards client", config.AuthConfig{TrustProxyHeaders: true, TrustedProxyCIDRs: []netip.Prefix{proxy}}, sourceRequest("10.1.1.1:80", "198.51.100.1"), "198.51.100.1", true},
		{"caller padding left of trusted hop ignored", config.AuthConfig{TrustProxyHeaders: true, TrustedProxyCIDRs: []netip.Prefix{proxy}}, sourceRequest("10.1.1.1:80", "1.2.3.4, 198.51.100.1"), "198.51.100.1", true},
		{"hops without cidr", config.AuthConfig{TrustProxyHeaders: true, TrustedProxyHops: 1}, sourceRequest("203.0.113.9:80", "198.51.100.1"), "198.51.100.1", true},
		{"missing header from trusted proxy", config.AuthConfig{TrustProxyHeaders: true, TrustedProxyCIDRs: []netip.Prefix{proxy}}, sourceRequest("10.1.1.1:80"), "", false},
		{"malformed hop inside window", config.AuthConfig{TrustProxyHeaders: true, TrustedProxyCIDRs: []netip.Prefix{proxy}}, sourceRequest("10.1.1.1:80", "nope"), "", false},
		{"chain ends inside trusted range", config.AuthConfig{TrustProxyHeaders: true, TrustedProxyCIDRs: []netip.Prefix{proxy}}, sourceRequest("10.1.1.1:80", "10.2.2.2"), "", false},
		{"repeated field lines join", config.AuthConfig{TrustProxyHeaders: true, TrustedProxyCIDRs: []netip.Prefix{proxy}}, sourceRequest("10.1.1.1:80", "1.2.3.4", "198.51.100.1"), "198.51.100.1", true},
		{"untrusted peer ignores header", config.AuthConfig{TrustProxyHeaders: true, TrustedProxyCIDRs: []netip.Prefix{proxy}}, sourceRequest("203.0.113.9:80", "198.51.100.1"), "203.0.113.9", true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := requestSourceIP(tc.req, &tc.cfg)
			if got != tc.want || ok != tc.ok {
				t.Fatalf("got (%q, %v), want (%q, %v)", got, ok, tc.want, tc.ok)
			}
		})
	}
}

func TestRequestSourceHash(t *testing.T) {
	cfg := &config.AuthConfig{}
	if got := requestSourceHash(sourceRequest("garbage"), cfg); got != cache.UnattributedSourceHash {
		t.Fatalf("unattributed = %q", got)
	}
	a := requestSourceHash(sourceRequest("203.0.113.9:1"), cfg)
	b := requestSourceHash(sourceRequest("203.0.113.9:2"), cfg)
	c := requestSourceHash(sourceRequest("203.0.113.10:1"), cfg)
	if a != b || a == c || len(a) != 32 {
		t.Fatalf("hashes a=%q b=%q c=%q", a, b, c)
	}
}
