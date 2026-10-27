package auth

import (
	"context"
	"sync"
	"testing"
	"time"
)

const testSessionSecret = "0123456789abcdef0123456789abcdef"

type fakeStore struct {
	mu   sync.Mutex
	recs map[string]*HandoffRecord
	seq  int
}

func newFakeStore() *fakeStore { return &fakeStore{recs: map[string]*HandoffRecord{}} }

func (f *fakeStore) Create(_ context.Context, rec HandoffRecord) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.seq++
	rec.ID = string(rune('a' + f.seq))
	f.recs[rec.ID] = &rec
	return nil
}

func (f *fakeStore) FindByCodeHash(_ context.Context, channel, codeHash string) (*HandoffRecord, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, r := range f.recs {
		if (channel == HandoffChannelBody && r.BodyCodeHash == codeHash) ||
			(channel == HandoffChannelCookie && r.CookieCodeHash == codeHash) {
			cp := *r
			return &cp, nil
		}
	}
	return nil, nil
}

func (f *fakeStore) Claim(_ context.Context, id, channel string, ct []byte, exp time.Time) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	r := f.recs[id]
	if r == nil || r.Channel != "" {
		return false, nil
	}
	r.Channel, r.TokenCiphertext, r.ExpiresAt = channel, ct, exp
	return true, nil
}

const testVerifier = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ-_0123456789"

func newTestService() (*HandoffService, *fakeStore, *time.Time) {
	store := newFakeStore()
	issued := 0
	svc := NewHandoffService(store, testSessionSecret, func(userID, email, name string) (string, error) {
		issued++
		return "token-" + userID, nil
	})
	clock := time.Unix(1_800_000_000, 0)
	svc.now = func() time.Time { return clock }
	return svc, store, &clock
}

func TestRedeemBodyChannelNeedsMatchingVerifier(t *testing.T) {
	svc, _, _ := newTestService()
	ctx := context.Background()
	body, _, err := svc.Create(ctx, "u1", "a@b.co", "A", PKCEChallengeS256(testVerifier))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Redeem(ctx, HandoffChannelBody, body, "wrong-verifier"); err != ErrHandoffInvalid {
		t.Fatalf("wrong verifier err = %v", err)
	}
	tok, err := svc.Redeem(ctx, HandoffChannelBody, body, testVerifier)
	if err != nil || tok != "token-u1" {
		t.Fatalf("redeem = %q, %v", tok, err)
	}
}

func TestRedeemReplayReturnsSameTokenThenExpires(t *testing.T) {
	svc, _, clock := newTestService()
	ctx := context.Background()
	body, _, _ := svc.Create(ctx, "u1", "a@b.co", "A", PKCEChallengeS256(testVerifier))
	first, err := svc.Redeem(ctx, HandoffChannelBody, body, testVerifier)
	if err != nil {
		t.Fatal(err)
	}
	second, err := svc.Redeem(ctx, HandoffChannelBody, body, testVerifier)
	if err != nil || second != first {
		t.Fatalf("replay = %q, %v", second, err)
	}
	*clock = clock.Add(handoffReplayTTL + time.Second)
	if _, err := svc.Redeem(ctx, HandoffChannelBody, body, testVerifier); err != ErrHandoffInvalid {
		t.Fatalf("expired replay err = %v", err)
	}
}

func TestRedeemOtherChannelIsRejectedAfterFirst(t *testing.T) {
	svc, _, _ := newTestService()
	ctx := context.Background()
	body, cookie, _ := svc.Create(ctx, "u1", "a@b.co", "A", PKCEChallengeS256(testVerifier))
	if _, err := svc.Redeem(ctx, HandoffChannelCookie, cookie, ""); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.Redeem(ctx, HandoffChannelBody, body, testVerifier); err != ErrHandoffInvalid {
		t.Fatalf("second channel err = %v", err)
	}
}

func TestRedeemRejectsUnknownExpiredAndBadChannel(t *testing.T) {
	svc, _, clock := newTestService()
	ctx := context.Background()
	body, _, _ := svc.Create(ctx, "u1", "a@b.co", "A", PKCEChallengeS256(testVerifier))
	if _, err := svc.Redeem(ctx, "other", body, testVerifier); err != ErrHandoffInvalid {
		t.Fatalf("bad channel err = %v", err)
	}
	if _, err := svc.Redeem(ctx, HandoffChannelBody, "unknown", testVerifier); err != ErrHandoffInvalid {
		t.Fatalf("unknown code err = %v", err)
	}
	*clock = clock.Add(HandoffTTL + time.Second)
	if _, err := svc.Redeem(ctx, HandoffChannelBody, body, testVerifier); err != ErrHandoffInvalid {
		t.Fatalf("expired err = %v", err)
	}
}

func TestSealedTokenIsBoundToChannelAndCode(t *testing.T) {
	sealed, err := sealSessionToken(testSessionSecret, HandoffChannelBody, "hash", "tok")
	if err != nil {
		t.Fatal(err)
	}
	if got, err := openSessionToken(testSessionSecret, HandoffChannelBody, "hash", sealed); err != nil || got != "tok" {
		t.Fatalf("open = %q, %v", got, err)
	}
	if _, err := openSessionToken(testSessionSecret, HandoffChannelCookie, "hash", sealed); err == nil {
		t.Fatal("channel swap must fail")
	}
	if _, err := openSessionToken("another-secret-another-secret-12345", HandoffChannelBody, "hash", sealed); err == nil {
		t.Fatal("wrong secret must fail")
	}
}
