package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/netip"
	"strings"

	"github.com/cuesoftinc/upstat/api/common/internal/cache"
	"github.com/cuesoftinc/upstat/api/common/internal/config"
)

// requestSourceHash buckets the sign-in rate limits; unattributed requests share one bucket.
func requestSourceHash(r *http.Request, cfg *config.AuthConfig) string {
	ip, ok := requestSourceIP(r, cfg)
	if !ok {
		return cache.UnattributedSourceHash
	}
	sum := sha256.Sum256([]byte(sourceBucketKey(ip)))
	return hex.EncodeToString(sum[:16])
}

// sourceBucketKey keys an IPv6 source by its /64, the block one subscriber controls.
func sourceBucketKey(ip string) string {
	addr, err := netip.ParseAddr(ip)
	if err != nil || !addr.Is6() {
		return ip
	}
	prefix, err := addr.Prefix(64)
	if err != nil {
		return ip
	}
	return prefix.String()
}

// requestSourceIP walks X-Forwarded-For only through proxies the config trusts.
func requestSourceIP(r *http.Request, cfg *config.AuthConfig) (string, bool) {
	peer, ok := parseRequestIP(r.RemoteAddr)
	if !ok {
		return "", false
	}
	if !cfg.TrustProxyHeaders {
		return peer.String(), true
	}

	rawXFF := strings.TrimSpace(strings.Join(r.Header.Values("X-Forwarded-For"), ","))
	if rawXFF == "" {
		if prefixContains(cfg.TrustedProxyCIDRs, peer) || cfg.TrustedProxyHops > 0 {
			return "", false
		}
		return peer.String(), true
	}
	parts := strings.Split(rawXFF, ",")

	current := peer
	trustedHops := 0
	for i := len(parts) - 1; i >= 0; i-- {
		if !prefixContains(cfg.TrustedProxyCIDRs, current) && trustedHops >= cfg.TrustedProxyHops {
			break
		}
		hop, valid := parseRequestIP(strings.TrimSpace(parts[i]))
		if !valid {
			return "", false
		}
		current = hop
		trustedHops++
	}
	if trustedHops == 0 {
		return peer.String(), true
	}
	if trustedHops < cfg.TrustedProxyHops || prefixContains(cfg.TrustedProxyCIDRs, current) {
		return "", false
	}
	return current.String(), true
}

func parseRequestIP(raw string) (netip.Addr, bool) {
	if addrPort, err := netip.ParseAddrPort(raw); err == nil {
		return canonicalIP(addrPort.Addr()), true
	}
	addr, err := netip.ParseAddr(raw)
	if err != nil {
		return netip.Addr{}, false
	}
	return canonicalIP(addr), true
}

// canonicalIP folds every spelling of one address onto one bucket key.
func canonicalIP(addr netip.Addr) netip.Addr {
	return addr.Unmap().WithZone("")
}

func prefixContains(prefixes []netip.Prefix, addr netip.Addr) bool {
	for _, prefix := range prefixes {
		if prefix.Contains(addr) {
			return true
		}
	}
	return false
}
