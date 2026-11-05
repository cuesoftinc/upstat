package service

import (
	"context"
	"errors"
	"net/mail"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/auth"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/pkg/snapshot"
)

// ── Sign-in adapters (flows/auth.md; the handler owns the flow) ─────────

// AuthUsers is the sign-in handler's account store. Signing in also turns
// pending invites for the email into memberships.
type AuthUsers struct{ S *Services }

func (a AuthUsers) GetUser(ctx context.Context, email string) (*auth.User, error) {
	var out *auth.User
	err := a.S.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		u, err := repository.UserByEmail(ctx, tx, strings.ToLower(email))
		if err != nil {
			return err
		}
		if err := repository.ClaimInvites(ctx, tx, u.ID, u.Email, u.Name); err != nil {
			return err
		}
		out = &auth.User{ID: u.ID, Email: u.Email, Name: u.Name}
		return repository.ConfigChanged(ctx, tx, snapshot.KindMembers)
	})
	if errors.Is(err, repository.ErrNotFound) {
		return nil, auth.ErrUserNotFound
	}
	return out, err
}

func (a AuthUsers) CreateUser(ctx context.Context, user auth.User) error {
	return a.S.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		_, err := repository.CreateUser(ctx, tx, strings.ToLower(user.Email), user.Name)
		return err
	})
}

// Handoffs is the sign-in handoff store on Postgres.
type Handoffs struct{ S *Services }

func (h Handoffs) Create(ctx context.Context, rec auth.HandoffRecord) error {
	return h.S.DB.AsSystem(ctx, func(tx pgx.Tx) error { return repository.CreateHandoff(ctx, tx, rec) })
}

func (h Handoffs) FindByCodeHash(ctx context.Context, channel, codeHash string) (*auth.HandoffRecord, error) {
	var rec *auth.HandoffRecord
	err := h.S.DB.AsSystem(ctx, func(tx pgx.Tx) (err error) {
		rec, err = repository.HandoffByCodeHash(ctx, tx, channel, codeHash)
		return err
	})
	if errors.Is(err, repository.ErrNotFound) {
		return nil, nil
	}
	return rec, err
}

func (h Handoffs) Claim(ctx context.Context, id, channel string, ciphertext []byte, expiresAt time.Time) (bool, error) {
	var ok bool
	err := h.S.DB.AsSystem(ctx, func(tx pgx.Tx) (err error) {
		ok, err = repository.ClaimHandoff(ctx, tx, id, channel, ciphertext, expiresAt)
		return err
	})
	return ok, err
}

// ── Callers ─────────────────────────────────────────────────────────────

// CallerFor resolves a session's user into their active org and role
// (roles live in the database, never in the token: engineering.md §2).
func (s *Services) CallerFor(ctx context.Context, userID string) (*Caller, error) {
	var c *Caller
	err := s.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		a, err := repository.AccessFor(ctx, tx, userID)
		if err != nil {
			return err
		}
		c = &Caller{UserID: a.UserID, Email: a.Email, Name: a.Name, OrgID: a.OrgID, Role: a.Role}
		return nil
	})
	return c, err
}

// ── Orgs ────────────────────────────────────────────────────────────────

func validTimezone(tz string) bool {
	_, err := time.LoadLocation(tz)
	return err == nil && tz != "" && tz != "Local"
}

func (s *Services) ListOrgs(ctx context.Context, c *Caller) ([]model.Org, error) {
	var out []model.Org
	err := s.DB.AsSystem(ctx, func(tx pgx.Tx) (err error) {
		out, err = repository.OrgsForUser(ctx, tx, c.UserID)
		return err
	})
	return out, err
}

func (s *Services) CurrentOrg(ctx context.Context, c *Caller) (*model.Org, error) {
	if c.OrgID == "" {
		return nil, notFound("org")
	}
	var out *model.Org
	err := s.DB.AsSystem(ctx, func(tx pgx.Tx) (err error) {
		out, err = repository.OrgByID(ctx, tx, c.OrgID)
		return err
	})
	return out, orNotFound(err, "org")
}

func (s *Services) CreateOrg(ctx context.Context, c *Caller, name, timezone string) (*model.Org, error) {
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 80 {
		return nil, invalid("bad_shape", "name is required (1-80 characters)")
	}
	if timezone == "" {
		timezone = "UTC"
	}
	if !validTimezone(timezone) {
		return nil, invalid("invalid_timezone", "timezone must be an IANA name")
	}
	var out *model.Org
	err := s.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		orgs, err := repository.OrgsForUser(ctx, tx, c.UserID)
		if err != nil {
			return err
		}
		for _, o := range orgs {
			if strings.EqualFold(o.Name, name) {
				return conflict("name_taken", "an organization with this name exists")
			}
		}
		if out, err = repository.CreateOrg(ctx, tx, c.UserID, c.Email, c.Name, name, timezone); err != nil {
			return err
		}
		return configChanged(ctx, tx, snapshot.KindOrgs, snapshot.KindMembers)
	})
	return out, err
}

func (s *Services) UpdateOrg(ctx context.Context, c *Caller, id string, name, timezone *string) (*model.Org, error) {
	if name != nil {
		trimmed := strings.TrimSpace(*name)
		if trimmed == "" || len(trimmed) > 80 {
			return nil, invalid("bad_shape", "name must be 1-80 characters")
		}
		name = &trimmed
	}
	if timezone != nil && !validTimezone(*timezone) {
		return nil, invalid("invalid_timezone", "timezone must be an IANA name")
	}
	var out *model.Org
	err := s.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		role, err := repository.MemberRole(ctx, tx, id, c.UserID)
		if err != nil {
			return notFound("org")
		}
		if rank[role] < rank["owner"] {
			return errForbidden
		}
		if out, err = repository.UpdateOrg(ctx, tx, id, name, timezone); err != nil {
			return err
		}
		return configChanged(ctx, tx, snapshot.KindOrgs)
	})
	return out, orNotFound(err, "org")
}

func (s *Services) ActivateOrg(ctx context.Context, c *Caller, id string) (*model.Org, error) {
	var out *model.Org
	err := s.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		if _, err := repository.MemberRole(ctx, tx, id, c.UserID); err != nil {
			return notFound("org")
		}
		if err := repository.SetActiveOrg(ctx, tx, c.UserID, id); err != nil {
			return err
		}
		var err error
		if out, err = repository.OrgByID(ctx, tx, id); err != nil {
			return err
		}
		return configChanged(ctx, tx, snapshot.KindMembers)
	})
	return out, orNotFound(err, "org")
}

// Onboarding is the first-run state (pages.md B1).
func (s *Services) Onboarding(ctx context.Context, c *Caller) (*model.Onboarding, error) {
	out := &model.Onboarding{}
	if c.OrgID == "" {
		return out, nil
	}
	out.OrgCreated = true
	err := s.DB.AsOrg(ctx, c.OrgID, func(tx pgx.Tx) (err error) {
		out.IngestKey, err = repository.FirstIngestKeyMasked(ctx, tx)
		return err
	})
	if err != nil {
		return nil, err
	}
	if s.Telemetry != nil {
		// has_data is a nicety: a slow or absent query service reads false.
		qctx, cancel := context.WithTimeout(ctx, 3*time.Second)
		defer cancel()
		out.HasData, _ = s.Telemetry.HasData(qctx, c.OrgID)
	}
	return out, nil
}

// ── Members ─────────────────────────────────────────────────────────────

var memberRoles = map[string]bool{"owner": true, "admin": true, "member": true, "viewer": true}

func (s *Services) ListMembers(ctx context.Context, c *Caller) ([]model.Member, error) {
	var out []model.Member
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.ListMembers(ctx, tx)
		return err
	})
	return out, err
}

func (s *Services) InviteMember(ctx context.Context, c *Caller, email, role string) (*model.Member, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if _, err := mail.ParseAddress(email); err != nil || email == "" {
		return nil, invalid("bad_shape", "email is required")
	}
	if role == "" {
		role = "member"
	}
	if !memberRoles[role] || role == "owner" {
		return nil, invalid("bad_shape", "role must be admin, member or viewer")
	}
	var out *model.Member
	err := s.inOrg(ctx, c, "owner", func(tx pgx.Tx) (err error) {
		out, err = repository.InviteMember(ctx, tx, c.OrgID, email, strings.Split(email, "@")[0], role)
		if errors.Is(err, repository.ErrConflict) {
			return conflict("already_member", "this email is already on the org")
		}
		return err
	})
	if err == nil {
		// A user who already has an account picks the invite up now.
		_ = s.DB.AsSystem(ctx, func(tx pgx.Tx) error {
			u, err := repository.UserByEmail(ctx, tx, email)
			if err != nil {
				return nil
			}
			if err := repository.ClaimInvites(ctx, tx, u.ID, u.Email, u.Name); err != nil {
				return err
			}
			return configChanged(ctx, tx, snapshot.KindMembers)
		})
	}
	return out, err
}

func (s *Services) UpdateMember(ctx context.Context, c *Caller, id string, role, status *string) (*model.Member, error) {
	if role != nil && !memberRoles[*role] {
		return nil, invalid("bad_shape", "role must be owner, admin, member or viewer")
	}
	if status != nil && *status != "active" && *status != "disabled" {
		return nil, invalid("bad_shape", "status must be active or disabled")
	}
	var out *model.Member
	err := s.inOrg(ctx, c, "owner", func(tx pgx.Tx) error {
		owners, err := repository.LockOwners(ctx, tx)
		if err != nil {
			return err
		}
		m, err := repository.GetMember(ctx, tx, id)
		if err != nil {
			return orNotFound(err, "member")
		}
		losingOwner := m.Role == "owner" && ((role != nil && *role != "owner") || (status != nil && *status != "active"))
		if losingOwner && owners <= 1 {
			return invalid("last_owner", "the org must keep an owner")
		}
		if status != nil && m.Status == "invited" {
			status = nil // an invite becomes active by signing in
		}
		if out, err = repository.UpdateMember(ctx, tx, id, role, status); err != nil {
			return err
		}
		return configChanged(ctx, tx, snapshot.KindMembers)
	})
	return out, err
}

func (s *Services) RemoveMember(ctx context.Context, c *Caller, id string) error {
	return s.inOrg(ctx, c, "owner", func(tx pgx.Tx) error {
		owners, err := repository.LockOwners(ctx, tx)
		if err != nil {
			return err
		}
		m, err := repository.GetMember(ctx, tx, id)
		if err != nil {
			return orNotFound(err, "member")
		}
		if m.Role == "owner" && owners <= 1 {
			return invalid("last_owner", "the org owner cannot be removed")
		}
		if err := repository.DeleteMember(ctx, tx, id); err != nil {
			return err
		}
		return configChanged(ctx, tx, snapshot.KindMembers)
	})
}

// configChanged queues snapshot rewrites for each kind.
func configChanged(ctx context.Context, tx pgx.Tx, kinds ...string) error {
	for _, kind := range kinds {
		if err := repository.ConfigChanged(ctx, tx, kind); err != nil {
			return err
		}
	}
	return nil
}
