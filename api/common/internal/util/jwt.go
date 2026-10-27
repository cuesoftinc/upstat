package util

import (
	"fmt"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v4"
)

type Claims struct {
	jwt.RegisteredClaims
}

const defaultAccessTTL = 2 * time.Hour

var accessTTL = defaultAccessTTL

// SetAccessTTL sets the lifetime of issued session tokens; call once at startup.
func SetAccessTTL(ttl time.Duration) {
	if ttl > 0 {
		accessTTL = ttl
	}
}

// SessionClaims is the identity carried by a session token.
type SessionClaims struct {
	UserID string
	Email  string
	Name   string
}

// GenerateToken issues a session token that expires after the access TTL.
func GenerateToken(userId string, email string) (string, error) {
	return GenerateSessionToken(userId, email, "")
}

// GenerateSessionToken issues a session token carrying the display name when one is known.
func GenerateSessionToken(userId, email, name string) (string, error) {
	claims := jwt.MapClaims{
		"userId": userId,
		"email":  email,
		"exp":    time.Now().Add(accessTTL).Unix(),
		"iat":    time.Now().Unix(),
		"issuer": "cuesoftinc",
	}
	if name != "" {
		claims["name"] = name
	}

	return signToken(claims)
}

// GenerateNonExpiringToken Generate a JWT token that never expires (for service accounts)
func GenerateNonExpiringToken(userId string, email string) (string, error) {
	claims := jwt.MapClaims{
		"userId": userId,
		"email":  email,
		"iat":    time.Now().Unix(),
		"issuer": "cuesoftinc",
	}

	return signToken(claims)
}

// signToken signs claims with JWT_SECRET, refusing an empty key (an empty
// secret would silently produce forgeable tokens).
func signToken(claims jwt.MapClaims) (string, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return "", fmt.Errorf("JWT_SECRET is not set")
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func ValidateToken(tokenString string) (string, string, error) {
	claims, err := ValidateSessionToken(tokenString)
	if err != nil {
		return "", "", err
	}
	return claims.UserID, claims.Email, nil
}

// ValidateSessionToken verifies the signature and expiry and returns the token's identity.
func ValidateSessionToken(tokenString string) (*SessionClaims, error) {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return nil, fmt.Errorf("JWT_SECRET is not set")
	}
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		userID, _ := claims["userId"].(string)
		emailID, _ := claims["email"].(string)
		name, _ := claims["name"].(string)
		return &SessionClaims{UserID: userID, Email: emailID, Name: name}, nil
	}
	return nil, fmt.Errorf("invalid token claims")
}
