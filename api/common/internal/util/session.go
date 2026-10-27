package util

import (
	"context"
	"net/http"
	"net/url"
	"strings"
)

// SessionSettings tells request authentication where the session cookie lives and which origins may use it.
type SessionSettings struct {
	CookieName    string
	AllowedOrigin func(origin string) bool
}

var sessionSettings SessionSettings

// ConfigureSession sets the cookie name and origin check; call once at startup.
func ConfigureSession(s SessionSettings) {
	sessionSettings = s
}

// authenticateHeaders resolves a session from a Bearer header or, failing that, the session cookie.
func authenticateHeaders(authorization, cookie, origin, fetchSite string) (*SessionClaims, bool) {
	if authorization != "" {
		fields := strings.Fields(authorization)
		if len(fields) != 2 || !strings.EqualFold(fields[0], "Bearer") {
			return nil, false
		}
		return validClaims(fields[1])
	}

	if sessionSettings.CookieName == "" || cookie == "" {
		return nil, false
	}
	token := cookieValue(cookie, sessionSettings.CookieName)
	if token == "" || !cookieOriginAllowed(origin, fetchSite) {
		return nil, false
	}
	return validClaims(token)
}

func validClaims(token string) (*SessionClaims, bool) {
	claims, err := ValidateSessionToken(token)
	if err != nil || claims.UserID == "" || claims.Email == "" {
		return nil, false
	}
	return claims, true
}

func cookieValue(header, name string) string {
	req := http.Request{Header: http.Header{"Cookie": []string{header}}}
	c, err := req.Cookie(name)
	if err != nil {
		return ""
	}
	return c.Value
}

// cookieOriginAllowed blocks cross-site use of an ambient cookie: the caller must state an allowed origin.
func cookieOriginAllowed(origin, fetchSite string) bool {
	if fetchSite == "cross-site" {
		return false
	}
	if origin == "" || sessionSettings.AllowedOrigin == nil {
		return false
	}
	u, err := url.Parse(origin)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return false
	}
	return sessionSettings.AllowedOrigin(u.Scheme + "://" + u.Host)
}

// SessionMiddleware admits requests that carry a valid Bearer token or session cookie.
func SessionMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := authenticateHeaders(
			r.Header.Get("Authorization"),
			r.Header.Get("Cookie"),
			r.Header.Get("Origin"),
			r.Header.Get("Sec-Fetch-Site"),
		)
		if !ok {
			http.Error(w, `{"error":{"code":"unauthorized","message":"Authentication required","details":[]}}`, http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), userIDContextKey, claims.UserID)
		ctx = context.WithValue(ctx, emailContextKey, claims.Email)
		ctx = context.WithValue(ctx, nameContextKey, claims.Name)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func NameFromContext(ctx context.Context) (string, bool) {
	name, ok := ctx.Value(nameContextKey).(string)
	return name, ok
}
