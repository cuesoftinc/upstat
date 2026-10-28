package handler

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"net/http"
	"net/url"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/mongo"

	"github.com/cuesoftinc/upstat/api/common/internal/auth"
	"github.com/cuesoftinc/upstat/api/common/internal/cache"
	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/util"
)

const (
	oauthHandoffCookie = "upstat_oauth_handoff"

	ssoStateTTL         = 10 * time.Minute
	ssoStartRateWindow  = time.Minute
	ssoCookieStateTTL   = 600
	maxExchangeBodySize = 4096

	ssoDescriptionStartFailed      = "Google sign-in could not be started. Please try again."
	ssoDescriptionRateLimited      = "Too many sign-in attempts. Please wait and try again."
	ssoDescriptionInvalidHandoff   = "Google sign-in expired. Please try again."
	ssoDescriptionInvalidRequest   = "The sign-in request is invalid."
	ssoDescriptionVerifierRequired = "This dashboard must finish sign-in with its PKCE verifier: start login with ?cv=<challenge> and POST {handoff, verifier} as JSON to /v1/auth/sso/exchange."
	ssoDescriptionExchangeFailed   = "Google sign-in could not be completed. Please try again."
	ssoDescriptionAccessDenied     = "Google sign-in was cancelled."
	ssoDescriptionMissingState     = "Google sign-in state is missing. Please try again."
	ssoDescriptionInvalidState     = "Google sign-in state is invalid. Please try again."
	ssoDescriptionExpiredState     = "Google sign-in expired. Please try again."
	ssoDescriptionMissingCode      = "Google did not return an authorization code. Please try again."
)

// stateStore holds the pending sign-in state and the start limiter.
type stateStore interface {
	Set(ctx context.Context, key string, v any, ttl time.Duration) error
	Take(ctx context.Context, key string, dst any) error
	AllowSSOStart(ctx context.Context, sourceHash, reservationID string, now time.Time, limits cache.SSOStartLimits) (bool, error)
	ReleaseSSOStart(ctx context.Context, sourceHash, reservationID string) error
}

type googleClient interface {
	AuthorizeURL(state, codeChallenge string) string
	ExchangeCode(ctx context.Context, code, codeVerifier string) (*auth.GoogleIdentity, error)
}

type handoffs interface {
	Create(ctx context.Context, userID, email, name, challenge string) (bodyCode, cookieCode string, err error)
	Redeem(ctx context.Context, channel, code, verifier string) (string, error)
}

type userStore interface {
	GetUser(email string) (*model.User, error)
	CreateUser(user model.User) (*mongo.InsertOneResult, error)
}

type ssoStateRecord struct {
	CodeVerifier string `json:"code_verifier"`
	Challenge    string `json:"challenge"`
	SourceHash   string `json:"source_hash"`
	ReturnTo     string `json:"return_to"`
}

// AuthHandler serves the Google sign-in routes on the HTTP mux.
type AuthHandler struct {
	cfg     *config.AuthConfig
	store   stateStore
	google  googleClient
	handoff handoffs
	users   userStore
}

func NewAuthHandler(cfg *config.AuthConfig, store stateStore, google googleClient, handoff handoffs, users userStore) *AuthHandler {
	return &AuthHandler{cfg: cfg, store: store, google: google, handoff: handoff, users: users}
}

// Register mounts the sign-in routes; the credentialed ones answer CORS preflights for allowed origins.
func (h *AuthHandler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /v1/auth/sso/google", h.GoogleLogin)
	mux.HandleFunc("GET /v1/auth/sso/google/callback", h.GoogleCallback)
	mux.Handle("POST /v1/auth/sso/exchange", h.cors(http.HandlerFunc(h.ExchangeSSOHandoff)))
	mux.Handle("POST /v1/auth/logout", h.cors(http.HandlerFunc(h.Logout)))
	mux.Handle("GET /v1/auth/me", h.cors(util.SessionMiddleware(http.HandlerFunc(h.Me))))
	mux.Handle("OPTIONS /v1/auth/", h.cors(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})))
}

// GoogleLogin starts the Google flow and commits the PKCE challenge the exchange must later match.
func (h *AuthHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if !h.cfg.GoogleConfigured() {
		h.writeSSOStartError(w, r, http.StatusServiceUnavailable, "sso_config_invalid", ssoDescriptionStartFailed)
		return
	}

	returnTo := strings.TrimSpace(r.URL.Query().Get("return_to"))
	if returnTo != "" && !h.cfg.IsAllowedRedirectURL(returnTo) {
		h.writeSSOStartError(w, r, http.StatusBadRequest, "return_to_not_allowed",
			"return_to is not an allowed origin. Add its origin to CORS_ORIGINS.")
		return
	}

	state, err := randomState()
	if err != nil {
		slog.Error("google login: generate state", "error", err)
		h.writeSSOStartError(w, r, http.StatusInternalServerError, "sso_start_failed", ssoDescriptionStartFailed)
		return
	}

	sourceHash := requestSourceHash(r, h.cfg)
	allowed, err := h.store.AllowSSOStart(r.Context(), sourceHash, state, time.Now(), cache.SSOStartLimits{
		RateWindow:    ssoStartRateWindow,
		StateTTL:      ssoStateTTL,
		SourceRate:    h.cfg.SSOStartSourceRateLimit,
		GlobalRate:    h.cfg.SSOStartGlobalRateLimit,
		SourcePending: h.cfg.SSOStateSourceLimit,
		GlobalPending: h.cfg.SSOStateGlobalLimit,
	})
	if err != nil {
		slog.Error("google login: reserve sign-in start", "source_hash", sourceHash, "error", err)
		h.writeSSOStartError(w, r, http.StatusServiceUnavailable, "sso_unavailable", ssoDescriptionStartFailed)
		return
	}
	if !allowed {
		w.Header().Set("Retry-After", "60")
		slog.Warn("google login rate limited", "source_hash", sourceHash)
		h.writeSSOStartError(w, r, http.StatusTooManyRequests, "rate_limited", ssoDescriptionRateLimited)
		return
	}

	codeVerifier, err := auth.RandomURLToken()
	if err != nil {
		h.releaseSSOStart(r.Context(), sourceHash, state)
		slog.Error("google login: generate code verifier", "error", err)
		h.writeSSOStartError(w, r, http.StatusInternalServerError, "sso_start_failed", ssoDescriptionStartFailed)
		return
	}

	// Only a canonical commitment may occupy store space on this unauthenticated route.
	challenge := r.URL.Query().Get("cv")
	if !isValidSSOChallenge(challenge) {
		challenge = ""
	}
	record := ssoStateRecord{CodeVerifier: codeVerifier, Challenge: challenge, SourceHash: sourceHash, ReturnTo: returnTo}
	if err := h.store.Set(r.Context(), cache.SSOStateKey(state), record, ssoStateTTL); err != nil {
		h.releaseSSOStart(r.Context(), sourceHash, state)
		slog.Error("google login: store state", "error", err)
		h.writeSSOStartError(w, r, http.StatusServiceUnavailable, "sso_unavailable", ssoDescriptionStartFailed)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     h.cfg.OAuthStateCookie,
		Value:    state,
		Path:     "/",
		MaxAge:   ssoCookieStateTTL,
		HttpOnly: true,
		Secure:   !h.cfg.IsDevelopment(),
		SameSite: http.SameSiteLaxMode,
	})

	http.Redirect(w, r, h.google.AuthorizeURL(state, auth.PKCEChallengeS256(codeVerifier)), http.StatusTemporaryRedirect)
}

// GoogleCallback verifies state, exchanges the code, resolves the user and redirects with a one-time handoff code.
func (h *AuthHandler) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")

	stateCookie, err := r.Cookie(h.cfg.OAuthStateCookie)
	if err != nil || stateCookie.Value == "" {
		h.redirectWithError(w, r, "missing_state", ssoDescriptionMissingState)
		return
	}

	queryState := r.URL.Query().Get("state")
	if queryState == "" || queryState != stateCookie.Value {
		h.redirectWithError(w, r, "invalid_state", ssoDescriptionInvalidState)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     h.cfg.OAuthStateCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   !h.cfg.IsDevelopment(),
		SameSite: http.SameSiteLaxMode,
	})

	// Google reports a cancelled consent via ?error= with no code, so it is checked first.
	if oauthErr := r.URL.Query().Get("error"); oauthErr != "" {
		var record ssoStateRecord
		if err := h.store.Take(r.Context(), cache.SSOStateKey(queryState), &record); err == nil {
			h.releaseSSOStart(r.Context(), record.SourceHash, queryState)
		} else if !errors.Is(err, cache.ErrCacheMiss) {
			slog.Warn("google callback: discard denied state", "error", err)
		}
		code, description := safeOAuthError(oauthErr)
		slog.Info("google sign-in rejected by provider", "provider_error", oauthErr, "error_code", code)
		h.redirectWithErrorTo(w, r, record.ReturnTo, code, description)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		var record ssoStateRecord
		if err := h.store.Take(r.Context(), cache.SSOStateKey(queryState), &record); err == nil {
			h.releaseSSOStart(r.Context(), record.SourceHash, queryState)
		}
		h.redirectWithErrorTo(w, r, record.ReturnTo, "missing_code", ssoDescriptionMissingCode)
		return
	}

	var record ssoStateRecord
	if err := h.store.Take(r.Context(), cache.SSOStateKey(queryState), &record); err != nil || record.CodeVerifier == "" {
		if err != nil && !errors.Is(err, cache.ErrCacheMiss) {
			slog.Error("google callback: load state", "error", err)
		}
		h.redirectWithError(w, r, "expired_state", ssoDescriptionExpiredState)
		return
	}
	h.releaseSSOStart(r.Context(), record.SourceHash, queryState)

	identity, err := h.google.ExchangeCode(r.Context(), code, record.CodeVerifier)
	if err != nil {
		slog.Error("google callback: code exchange", "error", err)
		h.redirectWithErrorTo(w, r, record.ReturnTo, "sso_failed", ssoDescriptionExchangeFailed)
		return
	}

	user, err := h.resolveUser(identity)
	if err != nil {
		slog.Error("google callback: resolve user", "error", err)
		h.redirectWithErrorTo(w, r, record.ReturnTo, "sso_failed", ssoDescriptionExchangeFailed)
		return
	}

	bodyCode, cookieCode, err := h.handoff.Create(r.Context(), user.Id.Hex(), user.Email, user.Name, record.Challenge)
	if err != nil {
		slog.Error("google callback: create handoff", "error", err)
		h.redirectWithErrorTo(w, r, record.ReturnTo, "sso_failed", ssoDescriptionExchangeFailed)
		return
	}

	// Each channel has its own secret, so a captured callback URL cannot redeem through the cookie.
	http.SetCookie(w, &http.Cookie{
		Name:     oauthHandoffCookie,
		Value:    cookieCode,
		Path:     "/",
		MaxAge:   int(auth.HandoffTTL.Seconds()),
		HttpOnly: true,
		Secure:   !h.cfg.IsDevelopment(),
		SameSite: http.SameSiteLaxMode,
	})

	http.Redirect(w, r, h.frontendBase(record.ReturnTo)+"/auth/callback?handoff="+url.QueryEscape(bodyCode), http.StatusFound)
}

// ExchangeSSOHandoff trades a handoff code for the session token and sets the session cookie.
func (h *AuthHandler) ExchangeSSOHandoff(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")

	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxExchangeBodySize))
	if err != nil {
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			writeError(w, http.StatusRequestEntityTooLarge, "request_too_large", ssoDescriptionInvalidRequest)
		} else {
			writeError(w, http.StatusBadRequest, "invalid_body", ssoDescriptionInvalidRequest)
		}
		return
	}

	var req exchangeRequest
	if len(body) > 0 {
		mediaType, params, mtErr := mime.ParseMediaType(r.Header.Get("Content-Type"))
		charset, hasCharset := params["charset"]
		if mtErr != nil || mediaType != "application/json" || (hasCharset && !strings.EqualFold(charset, "utf-8")) {
			writeError(w, http.StatusBadRequest, "invalid_body", ssoDescriptionInvalidRequest)
			return
		}
		if err := decodeSingleJSON(body, &req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid_body", ssoDescriptionInvalidRequest)
			return
		}
		if !isValidURLToken(req.Handoff) || !isValidPKCEVerifier(req.Verifier) {
			writeError(w, http.StatusBadRequest, "invalid_request", ssoDescriptionInvalidRequest)
			return
		}
	}

	viaBody := len(body) > 0
	if !h.exchangeRequestAllowed(r, viaBody) {
		// An allowlisted secondary origin cannot use the cookie channel, so say what it needs instead.
		if !viaBody && h.isSecondaryAllowedOrigin(r) {
			writeError(w, http.StatusUnauthorized, "handoff_verifier_required", ssoDescriptionVerifierRequired)
			return
		}
		writeError(w, http.StatusUnauthorized, "handoff_invalid", ssoDescriptionInvalidHandoff)
		return
	}

	code := req.Handoff
	channel := auth.HandoffChannelBody
	if !viaBody {
		cookie, cookieErr := r.Cookie(oauthHandoffCookie)
		if cookieErr != nil || !isValidURLToken(cookie.Value) {
			writeError(w, http.StatusUnauthorized, "handoff_invalid", ssoDescriptionInvalidHandoff)
			return
		}
		code = cookie.Value
		channel = auth.HandoffChannelCookie
	}

	token, redeemErr := h.handoff.Redeem(r.Context(), channel, code, req.Verifier)
	if errors.Is(redeemErr, auth.ErrHandoffInvalid) {
		writeError(w, http.StatusUnauthorized, "handoff_invalid", ssoDescriptionInvalidHandoff)
		return
	}
	if redeemErr != nil {
		slog.Error("sso exchange", "error", redeemErr)
		writeError(w, http.StatusServiceUnavailable, "sso_unavailable", ssoDescriptionExchangeFailed)
		return
	}

	h.clearHandoffCookie(w)
	http.SetCookie(w, h.sessionCookie(token, int(h.cfg.JWTAccessTTL/time.Second)))
	writeData(w, http.StatusOK, exchangeResponse{
		AccessToken: token,
		TokenType:   "Bearer",
		ExpiresIn:   int(h.cfg.JWTAccessTTL / time.Second),
	})
}

// Logout clears the session and handoff cookies; cookie-sourced requests must come from the frontend.
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	token := bearerToken(r)
	fromCookie := false
	if token == "" {
		if cookie, err := r.Cookie(h.cfg.SessionCookieName); err == nil {
			token = cookie.Value
			fromCookie = true
		}
	}
	if (fromCookie || token == "") && !h.cookieChannelAllowed(r) {
		writeError(w, http.StatusForbidden, "csrf_rejected", "The logout request is not allowed.")
		return
	}
	http.SetCookie(w, h.sessionCookie("", -1))
	h.clearHandoffCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

// Me returns the identity carried by the session token.
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	id, _ := util.UserIDFromContext(r.Context())
	email, _ := util.EmailFromContext(r.Context())
	name, _ := util.NameFromContext(r.Context())
	writeData(w, http.StatusOK, meResponse{ID: id, Email: email, Name: name})
}

type exchangeRequest struct {
	Handoff  string `json:"handoff"`
	Verifier string `json:"verifier"`
}

type exchangeResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

type meResponse struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

// resolveUser finds the account for a verified Google email, creating it on first sign-in.
func (h *AuthHandler) resolveUser(identity *auth.GoogleIdentity) (*model.User, error) {
	user, err := h.users.GetUser(identity.Email)
	if err == nil {
		return user, nil
	}
	if !errors.Is(err, mongo.ErrNoDocuments) {
		return nil, fmt.Errorf("look up user: %w", err)
	}
	name := identity.Name
	if name == "" {
		name = identity.Email
	}
	if _, err := h.users.CreateUser(model.User{Name: name, Email: identity.Email}); err != nil {
		return nil, fmt.Errorf("create user: %w", err)
	}
	user, err = h.users.GetUser(identity.Email)
	if err != nil {
		return nil, fmt.Errorf("reload user: %w", err)
	}
	return user, nil
}

func isValidSSOChallenge(s string) bool {
	return isValidURLToken(s)
}

// isValidURLToken matches a 43-character base64url token.
func isValidURLToken(s string) bool {
	if len(s) != 43 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		valid := (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
			(c >= '0' && c <= '9') || c == '-' || c == '_'
		if !valid {
			return false
		}
	}
	return true
}

// isValidPKCEVerifier matches the RFC 7636 code-verifier syntax.
func isValidPKCEVerifier(s string) bool {
	if len(s) < 43 || len(s) > 128 {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		valid := (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
			(c >= '0' && c <= '9') || c == '-' || c == '.' || c == '_' || c == '~'
		if !valid {
			return false
		}
	}
	return true
}

func (h *AuthHandler) isSecondaryAllowedOrigin(r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	return origin != "" && origin != h.cfg.FrontendOrigin() && h.cfg.IsAllowedOrigin(origin)
}

func (h *AuthHandler) exchangeRequestAllowed(r *http.Request, viaBody bool) bool {
	if viaBody {
		origin := strings.TrimSpace(r.Header.Get("Origin"))
		return origin == "" || h.cfg.IsAllowedOrigin(origin)
	}
	return h.cookieChannelAllowed(r)
}

// cookieChannelAllowed admits cookie-authenticated requests from the frontend only; same-site alone cannot vouch without an Origin.
func (h *AuthHandler) cookieChannelAllowed(r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin != "" && origin != h.cfg.FrontendOrigin() {
		return false
	}
	switch strings.ToLower(strings.TrimSpace(r.Header.Get("Sec-Fetch-Site"))) {
	case "", "same-origin", "same-site":
	default:
		return false
	}
	return origin != "" || strings.EqualFold(strings.TrimSpace(r.Header.Get("Sec-Fetch-Site")), "same-origin")
}

func (h *AuthHandler) releaseSSOStart(ctx context.Context, sourceHash, reservationID string) {
	if err := h.store.ReleaseSSOStart(ctx, sourceHash, reservationID); err != nil {
		slog.Warn("release sign-in reservation", "error", err)
	}
}

func (h *AuthHandler) sessionCookie(value string, maxAge int) *http.Cookie {
	cookie := &http.Cookie{
		Name:     h.cfg.SessionCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   !h.cfg.IsDevelopment(),
		SameSite: http.SameSiteLaxMode,
	}
	if maxAge < 0 {
		cookie.Expires = time.Unix(1, 0).UTC()
	}
	return cookie
}

func (h *AuthHandler) clearHandoffCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     oauthHandoffCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Unix(1, 0).UTC(),
		HttpOnly: true,
		Secure:   !h.cfg.IsDevelopment(),
		SameSite: http.SameSiteLaxMode,
	})
}

func (h *AuthHandler) redirectWithError(w http.ResponseWriter, r *http.Request, code, message string) {
	h.redirectWithErrorTo(w, r, "", code, message)
}

// redirectWithErrorTo reports a failed sign-in to the web app that started it.
func (h *AuthHandler) redirectWithErrorTo(w http.ResponseWriter, r *http.Request, returnTo, code, message string) {
	target := h.frontendBase(returnTo) + "/signin?error=" + url.QueryEscape(code) +
		"&error_description=" + url.QueryEscape(message) +
		"&message=" + url.QueryEscape(message)
	http.Redirect(w, r, target, http.StatusFound)
}

func (h *AuthHandler) frontendBase(returnTo string) string {
	if returnTo != "" {
		return strings.TrimRight(returnTo, "/")
	}
	return strings.TrimRight(h.cfg.FrontendURL, "/")
}

// writeSSOStartError redirects browser navigations and answers API callers with JSON.
func (h *AuthHandler) writeSSOStartError(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	if strings.EqualFold(strings.TrimSpace(r.Header.Get("Sec-Fetch-Dest")), "document") ||
		strings.Contains(strings.ToLower(r.Header.Get("Accept")), "text/html") {
		h.redirectWithError(w, r, code, message)
		return
	}
	writeError(w, status, code, message)
}

// cors allows credentialed requests from the configured web origins only.
func (h *AuthHandler) cors(next http.Handler) http.Handler {
	return corsFor(h.cfg.IsAllowedOrigin, "GET, POST, OPTIONS", next)
}

func corsFor(allowed func(origin string) bool, methods string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && allowed(origin) {
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			if r.Method == http.MethodOptions {
				w.Header().Set("Access-Control-Allow-Methods", methods)
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
				w.Header().Set("Access-Control-Max-Age", "600")
			}
		}
		next.ServeHTTP(w, r)
	})
}

func safeOAuthError(providerCode string) (string, string) {
	if providerCode == "access_denied" {
		return "access_denied", ssoDescriptionAccessDenied
	}
	return "oauth_failed", ssoDescriptionExchangeFailed
}

func decodeSingleJSON(body []byte, dst any) error {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		return err
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		return errors.New("unexpected trailing data")
	}
	return nil
}

func bearerToken(r *http.Request) string {
	const prefix = "Bearer "
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	return strings.TrimPrefix(header, prefix)
}

func randomState() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate oauth state: %w", err)
	}
	return hex.EncodeToString(b), nil
}

type errorBody struct {
	Error errorDetail `json:"error"`
}

type errorDetail struct {
	Code    string   `json:"code"`
	Message string   `json:"message"`
	Details []string `json:"details"`
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, errorBody{Error: errorDetail{Code: code, Message: message, Details: []string{}}})
}

func writeData(w http.ResponseWriter, status int, data any) {
	writeJSON(w, status, map[string]any{"data": data})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}
