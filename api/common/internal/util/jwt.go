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

// GenerateToken Generate JWT Token (expires in 2 hours)
func GenerateToken(userId string, email string) (string, error) {
	claims := jwt.MapClaims{
		"userId": userId,
		"email":  email,
		"exp":    time.Now().Add(time.Hour * 2).Unix(),
		"iat":    time.Now().Unix(),
		"issuer": "cuesoftinc",
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
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(os.Getenv("JWT_SECRET")), nil
	})
	if err != nil {
		return "", "", err
	}
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		userID, _ := claims["userId"].(string)
		emailID, _ := claims["email"].(string)
		return userID, emailID, nil
	}
	return "", "", fmt.Errorf("invalid token claims")
}
