package utils

import (
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/golang-jwt/jwt/v4"
	"math/big"
	"net/http"
	"os"
)

const googleJWKSURL = "https://www.googleapis.com/oauth2/v3/certs"

type GoogleUser struct {
	Subject string
	Name    string
	Email   string
}

type googleJWKSet struct {
	Keys []googleJWK `json:"keys"`
}

type googleJWK struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	N   string `json:"n"`
	E   string `json:"e"`
}

func VerifyGoogleIDToken(idToken string) (*GoogleUser, error) {
	clientID := os.Getenv("GOOGLE_CLIENT_ID")
	if clientID == "" {
		return nil, errors.New("GOOGLE_CLIENT_ID is not configured")
	}
	if idToken == "" {
		return nil, errors.New("id token is required")
	}

	claims := jwt.MapClaims{}
	token, err := jwt.ParseWithClaims(idToken, claims, googleKeyFunc)
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("invalid google id token")
	}

	if !validGoogleIssuer(claims["iss"]) {
		return nil, errors.New("invalid google token issuer")
	}
	if !validAudience(claims["aud"], clientID) {
		return nil, errors.New("invalid google token audience")
	}
	if !validEmailVerified(claims["email_verified"]) {
		return nil, errors.New("google account email is not verified")
	}

	email, _ := claims["email"].(string)
	if email == "" {
		return nil, errors.New("google token has no email")
	}

	name, _ := claims["name"].(string)
	subject, _ := claims["sub"].(string)

	return &GoogleUser{
		Subject: subject,
		Name:    name,
		Email:   email,
	}, nil
}

func googleKeyFunc(token *jwt.Token) (any, error) {
	if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
		return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
	}

	kid, _ := token.Header["kid"].(string)
	if kid == "" {
		return nil, errors.New("google token missing key id")
	}

	resp, err := http.Get(googleJWKSURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to load google jwks: %s", resp.Status)
	}

	var keySet googleJWKSet
	if err := json.NewDecoder(resp.Body).Decode(&keySet); err != nil {
		return nil, err
	}

	for _, key := range keySet.Keys {
		if key.Kid == kid {
			return rsaPublicKey(key)
		}
	}

	return nil, errors.New("matching google public key not found")
}

func rsaPublicKey(key googleJWK) (*rsa.PublicKey, error) {
	modulus, err := base64.RawURLEncoding.DecodeString(key.N)
	if err != nil {
		return nil, err
	}

	exponentBytes, err := base64.RawURLEncoding.DecodeString(key.E)
	if err != nil {
		return nil, err
	}

	exponent := 0
	for _, b := range exponentBytes {
		exponent = exponent<<8 + int(b)
	}

	return &rsa.PublicKey{
		N: new(big.Int).SetBytes(modulus),
		E: exponent,
	}, nil
}

func validGoogleIssuer(value any) bool {
	issuer, _ := value.(string)
	return issuer == "accounts.google.com" || issuer == "https://accounts.google.com"
}

func validAudience(value any, expected string) bool {
	switch audience := value.(type) {
	case string:
		return audience == expected
	case []any:
		for _, item := range audience {
			if item == expected {
				return true
			}
		}
	}
	return false
}

func validEmailVerified(value any) bool {
	switch verified := value.(type) {
	case bool:
		return verified
	case string:
		return verified == "true"
	default:
		return false
	}
}
