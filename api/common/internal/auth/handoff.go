package auth

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"time"
)

const (
	HandoffChannelBody   = "body"
	HandoffChannelCookie = "cookie"

	HandoffTTL       = 5 * time.Minute
	handoffReplayTTL = time.Minute
)

// ErrHandoffInvalid covers every redeem failure so callers cannot tell a wrong code from a used one.
var ErrHandoffInvalid = errors.New("auth: invalid handoff")

// HandoffRecord is a one-time sign-in grant. Both codes are stored only as hashes.
type HandoffRecord struct {
	ID              string
	BodyCodeHash    string
	CookieCodeHash  string
	UserID          string
	Email           string
	Name            string
	Challenge       string
	Channel         string
	TokenCiphertext []byte
	ExpiresAt       time.Time
}

// HandoffStore persists handoffs; Claim must be atomic so only one redeem seals a token.
type HandoffStore interface {
	Create(ctx context.Context, rec HandoffRecord) error
	FindByCodeHash(ctx context.Context, channel, codeHash string) (*HandoffRecord, error)
	// Claim seals the record for channel; it reports false when another redeem already did.
	Claim(ctx context.Context, id, channel string, ciphertext []byte, expiresAt time.Time) (bool, error)
}

// TokenIssuer signs the session token for a user.
type TokenIssuer func(userID, email, name string) (string, error)

type HandoffService struct {
	store         HandoffStore
	sessionSecret string
	issue         TokenIssuer
	now           func() time.Time
}

func NewHandoffService(store HandoffStore, sessionSecret string, issue TokenIssuer) *HandoffService {
	return &HandoffService{store: store, sessionSecret: sessionSecret, issue: issue, now: time.Now}
}

// HashHandoffCode is the stored form of a handoff code.
func HashHandoffCode(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

// Create stores a grant and returns the URL code and the cookie code.
func (s *HandoffService) Create(ctx context.Context, userID, email, name, challenge string) (bodyCode, cookieCode string, err error) {
	bodyCode, err = RandomURLToken()
	if err != nil {
		return "", "", err
	}
	cookieCode, err = RandomURLToken()
	if err != nil {
		return "", "", err
	}
	rec := HandoffRecord{
		BodyCodeHash:   HashHandoffCode(bodyCode),
		CookieCodeHash: HashHandoffCode(cookieCode),
		UserID:         userID,
		Email:          email,
		Name:           name,
		Challenge:      challenge,
		ExpiresAt:      s.now().Add(HandoffTTL),
	}
	if err := s.store.Create(ctx, rec); err != nil {
		return "", "", err
	}
	return bodyCode, cookieCode, nil
}

// Redeem exchanges a code for the session token. The body channel also needs the PKCE verifier.
func (s *HandoffService) Redeem(ctx context.Context, channel, code, verifier string) (string, error) {
	if channel != HandoffChannelBody && channel != HandoffChannelCookie {
		return "", ErrHandoffInvalid
	}
	codeHash := HashHandoffCode(code)
	rec, err := s.store.FindByCodeHash(ctx, channel, codeHash)
	if err != nil || rec == nil {
		return "", ErrHandoffInvalid
	}
	now := s.now()
	if !rec.ExpiresAt.After(now) {
		return "", ErrHandoffInvalid
	}
	if channel == HandoffChannelBody && !verifierMatchesChallenge(verifier, rec.Challenge) {
		return "", ErrHandoffInvalid
	}
	if len(rec.TokenCiphertext) > 0 {
		return s.replay(rec, channel, codeHash)
	}
	if rec.Channel != "" {
		return "", ErrHandoffInvalid
	}

	token, err := s.issue(rec.UserID, rec.Email, rec.Name)
	if err != nil {
		return "", err
	}
	sealed, err := sealSessionToken(s.sessionSecret, channel, codeHash, token)
	if err != nil {
		return "", err
	}
	claimed, err := s.store.Claim(ctx, rec.ID, channel, sealed, now.Add(handoffReplayTTL))
	if err != nil {
		return "", err
	}
	if claimed {
		return token, nil
	}

	again, err := s.store.FindByCodeHash(ctx, channel, codeHash)
	if err != nil || again == nil || len(again.TokenCiphertext) == 0 || !again.ExpiresAt.After(s.now()) {
		return "", ErrHandoffInvalid
	}
	return s.replay(again, channel, codeHash)
}

func (s *HandoffService) replay(rec *HandoffRecord, channel, codeHash string) (string, error) {
	if rec.Channel != channel {
		return "", ErrHandoffInvalid
	}
	token, err := openSessionToken(s.sessionSecret, channel, codeHash, rec.TokenCiphertext)
	if err != nil {
		return "", ErrHandoffInvalid
	}
	return token, nil
}

func verifierMatchesChallenge(verifier, challenge string) bool {
	if verifier == "" || challenge == "" {
		return false
	}
	return hmac.Equal([]byte(PKCEChallengeS256(verifier)), []byte(challenge))
}

// RandomURLToken is 32 random bytes as 43 base64url characters.
func RandomURLToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func sessionTokenAEAD(secret string) (cipher.AEAD, error) {
	key := sha256.Sum256([]byte(secret))
	block, err := aes.NewCipher(key[:])
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}

func sealSessionToken(secret, channel, codeHash, token string) ([]byte, error) {
	aead, err := sessionTokenAEAD(secret)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, aead.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	return aead.Seal(nonce, nonce, []byte(token), []byte(channel+":"+codeHash)), nil
}

func openSessionToken(secret, channel, codeHash string, sealed []byte) (string, error) {
	aead, err := sessionTokenAEAD(secret)
	if err != nil {
		return "", err
	}
	if len(sealed) < aead.NonceSize() {
		return "", fmt.Errorf("auth: sealed token too short")
	}
	nonce, body := sealed[:aead.NonceSize()], sealed[aead.NonceSize():]
	plain, err := aead.Open(nil, nonce, body, []byte(channel+":"+codeHash))
	if err != nil {
		return "", err
	}
	return string(plain), nil
}
