package snapshot

import (
	"context"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/pkg/store"
)

func TestWriteVersionNeverRegresses(t *testing.T) {
	ctx := context.Background()
	s := store.NewMemory("p")
	at := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	first, err := Write(ctx, s, KindOrgs, []Org{{ID: "o1"}}, at)
	if err != nil {
		t.Fatal(err)
	}
	// A slower publisher whose clock reads earlier must still move forward.
	second, err := Write(ctx, s, KindOrgs, []Org{{ID: "o2"}}, at.Add(-time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if second <= first {
		t.Fatalf("version went from %d to %d", first, second)
	}
	_, stored, err := Read[Org](ctx, s, KindOrgs)
	if err != nil || stored != second {
		t.Fatalf("stored version = %d, %v; want %d", stored, err, second)
	}
}

func TestRefreshBoundsHowStaleAccessGets(t *testing.T) {
	ctx := context.Background()
	s := store.NewMemory("p")
	clock := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	grant := UserAccess{UserID: "u1", ActiveOrgID: "o1", Memberships: []Membership{{OrgID: "o1", Role: "admin"}}}
	if _, err := Write(ctx, s, KindMembers, []UserAccess{grant}, clock); err != nil {
		t.Fatal(err)
	}
	a := NewAccess(s)
	a.SetClock(func() time.Time { return clock })
	if err := a.Load(ctx); err != nil {
		t.Fatal(err)
	}
	if _, _, ok := a.ActiveOrg("u1"); !ok {
		t.Fatal("u1 should have access after the load")
	}
	if _, err := Write(ctx, s, KindMembers, []UserAccess{{UserID: "u1"}}, clock.Add(time.Second)); err != nil {
		t.Fatal(err)
	}

	clock = clock.Add(10 * time.Second)
	if a.Refresh(ctx, 30*time.Second) {
		t.Fatal("a refresh inside the max age must not reread")
	}
	clock = clock.Add(25 * time.Second)
	if !a.Refresh(ctx, 30*time.Second) {
		t.Fatal("a refresh past the max age must reread")
	}
	if _, _, ok := a.ActiveOrg("u1"); ok {
		t.Fatal("the revoked membership must be gone after the refresh")
	}
}
