package auth

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	googleAuthorizeURL = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenURL     = "https://oauth2.googleapis.com/token"
	googleUserInfoURL  = "https://www.googleapis.com/oauth2/v3/userinfo"
	googleScope        = "openid email profile"
	bodySnippetLimit   = 512
)

// GoogleIdentity is the verified profile returned by Google after a code exchange.
type GoogleIdentity struct {
	Subject string
	Email   string
	Name    string
}

// GoogleSSO runs the Google authorization-code flow with PKCE.
type GoogleSSO struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	HTTPClient   *http.Client

	tokenURL    string
	userInfoURL string
}

func NewGoogleSSO(clientID, clientSecret, redirectURI string) *GoogleSSO {
	return &GoogleSSO{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURI:  redirectURI,
		HTTPClient:   &http.Client{Timeout: 15 * time.Second},
		tokenURL:     googleTokenURL,
		userInfoURL:  googleUserInfoURL,
	}
}

// PKCEChallengeS256 is the base64url SHA-256 of a PKCE verifier.
func PKCEChallengeS256(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func (g *GoogleSSO) AuthorizeURL(state, codeChallenge string) string {
	q := url.Values{}
	q.Set("client_id", g.ClientID)
	q.Set("redirect_uri", g.RedirectURI)
	q.Set("response_type", "code")
	q.Set("scope", googleScope)
	q.Set("state", state)
	q.Set("code_challenge", codeChallenge)
	q.Set("code_challenge_method", "S256")
	q.Set("access_type", "offline")
	return googleAuthorizeURL + "?" + q.Encode()
}

// ExchangeCode trades an authorization code for the signed-in Google profile.
func (g *GoogleSSO) ExchangeCode(ctx context.Context, code, codeVerifier string) (*GoogleIdentity, error) {
	form := url.Values{}
	form.Set("client_id", g.ClientID)
	form.Set("client_secret", g.ClientSecret)
	form.Set("code", code)
	form.Set("redirect_uri", g.RedirectURI)
	form.Set("grant_type", "authorization_code")
	form.Set("code_verifier", codeVerifier)

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, g.tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := g.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google token exchange failed: status %d: %s", resp.StatusCode, bodySnippet(body))
	}

	var tok struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal(body, &tok); err != nil {
		return nil, fmt.Errorf("decode google token response: %w", err)
	}
	if tok.AccessToken == "" {
		return nil, fmt.Errorf("google token response missing access token")
	}

	infoReq, err := http.NewRequestWithContext(ctx, http.MethodGet, g.userInfoURL, nil)
	if err != nil {
		return nil, err
	}
	infoReq.Header.Set("Authorization", "Bearer "+tok.AccessToken)

	infoResp, err := g.HTTPClient.Do(infoReq)
	if err != nil {
		return nil, err
	}
	defer infoResp.Body.Close()
	infoBody, err := io.ReadAll(io.LimitReader(infoResp.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if infoResp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("google userinfo failed: status %d: %s", infoResp.StatusCode, bodySnippet(infoBody))
	}

	var info struct {
		Sub           string `json:"sub"`
		Email         string `json:"email"`
		EmailVerified any    `json:"email_verified"`
		Name          string `json:"name"`
	}
	if err := json.Unmarshal(infoBody, &info); err != nil {
		return nil, fmt.Errorf("decode google userinfo: %w", err)
	}
	if info.Sub == "" || info.Email == "" {
		return nil, fmt.Errorf("google userinfo missing subject or email")
	}
	if !emailVerified(info.EmailVerified) {
		return nil, fmt.Errorf("google email is not verified")
	}

	return &GoogleIdentity{
		Subject: info.Sub,
		Email:   strings.ToLower(strings.TrimSpace(info.Email)),
		Name:    strings.TrimSpace(info.Name),
	}, nil
}

// emailVerified accepts the boolean or string forms Google has returned for email_verified.
func emailVerified(v any) bool {
	switch t := v.(type) {
	case bool:
		return t
	case string:
		return t == "true"
	default:
		return false
	}
}

func bodySnippet(b []byte) string {
	if len(b) > bodySnippetLimit {
		b = b[:bodySnippetLimit]
	}
	return string(b)
}
