package handler

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/pkg/session"
	"github.com/cuesoftinc/upstat/api/common/pkg/snapshot"
	"github.com/cuesoftinc/upstat/api/common/pkg/store"
	"github.com/cuesoftinc/upstat/api/query/internal/telemetry"
)

type noRows struct{}

func (noRows) Rows(context.Context, string, string, map[string]string) ([]map[string]any, error) {
	return nil, nil
}

// TestRevokedAccessEndsWithinTheMaxAge proves a request re-reads the members
// snapshot once it is older than the max age, with no config event at all.
func TestRevokedAccessEndsWithinTheMaxAge(t *testing.T) {
	t.Setenv("JWT_SECRET", "0123456789abcdef0123456789abcdef")
	session.SetAccessTTL(time.Hour)
	session.ConfigureSession(session.SessionSettings{CookieName: "sess", AllowedOrigin: func(string) bool { return true }})
	token, err := session.GenerateSessionToken("u1", "ada@example.com", "Ada")
	if err != nil {
		t.Fatal(err)
	}

	ctx := context.Background()
	blobs := store.NewMemory("p")
	clock := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	grant := snapshot.UserAccess{UserID: "u1", ActiveOrgID: "o1", Memberships: []snapshot.Membership{{OrgID: "o1", Role: "admin"}}}
	if _, err := snapshot.Write(ctx, blobs, snapshot.KindMembers, []snapshot.UserAccess{grant}, clock); err != nil {
		t.Fatal(err)
	}
	access := snapshot.NewAccess(blobs)
	access.SetClock(func() time.Time { return clock })
	if err := access.Load(ctx); err != nil {
		t.Fatal(err)
	}
	api := New(&telemetry.Service{CH: noRows{}, Now: func() time.Time { return clock }}, access, Internal{})
	api.AccessMaxAge = 30 * time.Second
	mux := http.NewServeMux()
	api.Register(mux)
	get := func() int {
		req := httptest.NewRequest(http.MethodGet, "/v1/services", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		return rec.Code
	}

	if code := get(); code != http.StatusOK {
		t.Fatalf("member status = %d", code)
	}
	if _, err := snapshot.Write(ctx, blobs, snapshot.KindMembers, []snapshot.UserAccess{{UserID: "u1"}}, clock.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	clock = clock.Add(10 * time.Second)
	if code := get(); code != http.StatusOK {
		t.Fatalf("inside the max age the cached grant still holds, got %d", code)
	}
	clock = clock.Add(30 * time.Second)
	if code := get(); code != http.StatusNotFound {
		t.Fatalf("past the max age a revoked member must lose access, got %d", code)
	}
}
