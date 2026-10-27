package model

import (
	"go.mongodb.org/mongo-driver/bson/primitive"
	"time"
)

type SSOHandoff struct {
	ID              primitive.ObjectID `bson:"_id,omitempty"`
	BodyCodeHash    string             `bson:"body_code_hash"`
	CookieCodeHash  string             `bson:"cookie_code_hash"`
	UserID          string             `bson:"user_id"`
	Email           string             `bson:"email"`
	Name            string             `bson:"name"`
	Challenge       string             `bson:"challenge"`
	Channel         string             `bson:"channel,omitempty"`
	TokenCiphertext []byte             `bson:"token_ciphertext,omitempty"`
	ExpiresAt       time.Time          `bson:"expires_at"`
	CreatedAt       time.Time          `bson:"created_at"`
}
