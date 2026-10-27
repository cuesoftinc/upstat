package jobs

import (
	"context"

	"google.golang.org/api/idtoken"
)

type Claims struct {
	Email         string
	EmailVerified bool
}

type TokenVerifier interface {
	Verify(ctx context.Context, token, audience string) (*Claims, error)
}

type GoogleVerifier struct{}

// Verify checks the signature, issuer, expiry and audience of a Google OIDC token.
func (GoogleVerifier) Verify(ctx context.Context, token, audience string) (*Claims, error) {
	payload, err := idtoken.Validate(ctx, token, audience)
	if err != nil {
		return nil, err
	}

	claims := &Claims{}
	claims.Email, _ = payload.Claims["email"].(string)
	switch v := payload.Claims["email_verified"].(type) {
	case bool:
		claims.EmailVerified = v
	case string:
		claims.EmailVerified = v == "true"
	}
	return claims, nil
}
