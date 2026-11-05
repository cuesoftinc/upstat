package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/auth"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
)

// ── Users ───────────────────────────────────────────────────────────────

type User struct {
	ID          string
	Email       string
	Name        string
	ActiveOrgID *string
}

func scanUser(r pgx.Row) (*User, error) {
	var u User
	return &u, r.Scan(&u.ID, &u.Email, &u.Name, &u.ActiveOrgID)
}

func UserByEmail(ctx context.Context, tx pgx.Tx, email string) (*User, error) {
	return one(tx.QueryRow(ctx, `SELECT id, email, name, active_org_id FROM users WHERE email = $1`, email), scanUser)
}

func UserByID(ctx context.Context, tx pgx.Tx, id string) (*User, error) {
	return one(tx.QueryRow(ctx, `SELECT id, email, name, active_org_id FROM users WHERE id = $1`, id), scanUser)
}

func CreateUser(ctx context.Context, tx pgx.Tx, email, name string) (*User, error) {
	return one(tx.QueryRow(ctx, `INSERT INTO users (email, name) VALUES ($1, $2)
		ON CONFLICT (email) DO UPDATE SET updated_at = now()
		RETURNING id, email, name, active_org_id`, email, name), scanUser)
}

// ClaimInvites turns the invites for email into active memberships of
// userID, and gives the user an active org when they have none.
func ClaimInvites(ctx context.Context, tx pgx.Tx, userID, email, name string) error {
	if _, err := tx.Exec(ctx, `UPDATE members SET user_id = $1, status = 'active', name = CASE WHEN name = '' THEN $3 ELSE name END
		WHERE email = $2 AND status = 'invited'`, userID, email, name); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `UPDATE users SET active_org_id = (
			SELECT org_id FROM members WHERE user_id = $1 AND status = 'active' ORDER BY created_at LIMIT 1)
		WHERE id = $1 AND (active_org_id IS NULL OR NOT EXISTS (
			SELECT 1 FROM members WHERE user_id = $1 AND org_id = users.active_org_id AND status = 'active'))`, userID)
	return err
}

func SetActiveOrg(ctx context.Context, tx pgx.Tx, userID, orgID string) error {
	return affected(tx.Exec(ctx, `UPDATE users SET active_org_id = $2, updated_at = now() WHERE id = $1`, userID, orgID))
}

// Access is the caller's active org and role there; OrgID is empty when
// the user has no active membership.
type Access struct {
	UserID string
	Email  string
	Name   string
	OrgID  string
	Role   string
}

func AccessFor(ctx context.Context, tx pgx.Tx, userID string) (*Access, error) {
	a := Access{UserID: userID}
	var orgID, role *string
	err := tx.QueryRow(ctx, `SELECT u.email, u.name, m.org_id, m.role FROM users u
		LEFT JOIN members m ON m.user_id = u.id AND m.org_id = u.active_org_id AND m.status = 'active'
		WHERE u.id = $1`, userID).Scan(&a.Email, &a.Name, &orgID, &role)
	if err != nil {
		return nil, translate(err)
	}
	if orgID != nil {
		a.OrgID, a.Role = *orgID, *role
	}
	return &a, nil
}

// ── Sign-in handoffs (flows/auth.md) ─────────────────────────────────────

func CreateHandoff(ctx context.Context, tx pgx.Tx, rec auth.HandoffRecord) error {
	_, err := tx.Exec(ctx, `INSERT INTO sso_handoffs (body_code_hash, cookie_code_hash, user_id, email, name, challenge, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`, rec.BodyCodeHash, rec.CookieCodeHash, rec.UserID, rec.Email, rec.Name, rec.Challenge, rec.ExpiresAt)
	return translate(err)
}

func HandoffByCodeHash(ctx context.Context, tx pgx.Tx, channel, codeHash string) (*auth.HandoffRecord, error) {
	column := "body_code_hash"
	if channel == auth.HandoffChannelCookie {
		column = "cookie_code_hash"
	}
	var rec auth.HandoffRecord
	var ch *string
	err := tx.QueryRow(ctx, `SELECT id, body_code_hash, cookie_code_hash, user_id, email, name, challenge, channel, token_ciphertext, expires_at
		FROM sso_handoffs WHERE `+column+` = $1 AND expires_at > now()`, codeHash).Scan(
		&rec.ID, &rec.BodyCodeHash, &rec.CookieCodeHash, &rec.UserID, &rec.Email, &rec.Name, &rec.Challenge, &ch, &rec.TokenCiphertext, &rec.ExpiresAt)
	if err != nil {
		return nil, translate(err)
	}
	if ch != nil {
		rec.Channel = *ch
	}
	return &rec, nil
}

func ClaimHandoff(ctx context.Context, tx pgx.Tx, id, channel string, ciphertext []byte, expiresAt time.Time) (bool, error) {
	tag, err := tx.Exec(ctx, `UPDATE sso_handoffs SET channel = $2, token_ciphertext = $3, expires_at = $4
		WHERE id = $1 AND channel IS NULL`, id, channel, ciphertext, expiresAt)
	return tag.RowsAffected() == 1, err
}

func PruneHandoffs(ctx context.Context, tx pgx.Tx) (int64, error) {
	tag, err := tx.Exec(ctx, `DELETE FROM sso_handoffs WHERE expires_at < now() - interval '1 hour'`)
	return tag.RowsAffected(), err
}

// ── Orgs and members ────────────────────────────────────────────────────

func scanOrg(r pgx.Row) (*model.Org, error) {
	var o model.Org
	return &o, r.Scan(&o.ID, &o.Name, &o.Timezone, &o.CreatedAt)
}

// CreateOrg creates an org with userID as its owner and makes it active.
func CreateOrg(ctx context.Context, tx pgx.Tx, userID, email, userName, name, timezone string) (*model.Org, error) {
	org, err := one(tx.QueryRow(ctx, `INSERT INTO orgs (name, timezone, created_by) VALUES ($1, $2, $3)
		RETURNING id, name, timezone, created_at`, name, timezone, userID), scanOrg)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO members (org_id, user_id, email, name, role, status)
		VALUES ($1, $2, $3, $4, 'owner', 'active')`, org.ID, userID, email, userName); err != nil {
		return nil, translate(err)
	}
	return org, SetActiveOrg(ctx, tx, userID, org.ID)
}

// OrgsForUser lists the orgs the user is an active member of.
func OrgsForUser(ctx context.Context, tx pgx.Tx, userID string) ([]model.Org, error) {
	rows, err := tx.Query(ctx, `SELECT o.id, o.name, o.timezone, o.created_at FROM orgs o
		JOIN members m ON m.org_id = o.id WHERE m.user_id = $1 AND m.status = 'active' ORDER BY o.created_at`, userID)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanOrg)
}

func OrgByID(ctx context.Context, tx pgx.Tx, id string) (*model.Org, error) {
	return one(tx.QueryRow(ctx, `SELECT id, name, timezone, created_at FROM orgs WHERE id = $1`, id), scanOrg)
}

func UpdateOrg(ctx context.Context, tx pgx.Tx, id string, name, timezone *string) (*model.Org, error) {
	return one(tx.QueryRow(ctx, `UPDATE orgs SET name = coalesce($2, name), timezone = coalesce($3, timezone)
		WHERE id = $1 RETURNING id, name, timezone, created_at`, id, name, timezone), scanOrg)
}

// MemberRole is userID's active role in orgID, or ErrNotFound.
func MemberRole(ctx context.Context, tx pgx.Tx, orgID, userID string) (string, error) {
	var role string
	err := tx.QueryRow(ctx, `SELECT role FROM members WHERE org_id = $1 AND user_id = $2 AND status = 'active'`, orgID, userID).Scan(&role)
	return role, translate(err)
}

func scanMember(r pgx.Row) (*model.Member, error) {
	var m model.Member
	var userID *string
	if err := r.Scan(&m.ID, &m.Name, &m.Email, &m.Role, &m.Status, &userID); err != nil {
		return nil, err
	}
	if userID != nil {
		m.UserID = *userID
	}
	return &m, nil
}

const memberColumns = `id, name, email, role, status, user_id`

func ListMembers(ctx context.Context, tx pgx.Tx) ([]model.Member, error) {
	rows, err := tx.Query(ctx, `SELECT `+memberColumns+` FROM members ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanMember)
}

func GetMember(ctx context.Context, tx pgx.Tx, id string) (*model.Member, error) {
	return one(tx.QueryRow(ctx, `SELECT `+memberColumns+` FROM members WHERE id = $1`, id), scanMember)
}

// InviteMember adds an invite; an existing account with that email is
// linked when it next signs in (ClaimInvites).
func InviteMember(ctx context.Context, tx pgx.Tx, orgID, email, name, role string) (*model.Member, error) {
	return one(tx.QueryRow(ctx, `INSERT INTO members (org_id, email, name, role, status) VALUES ($1, $2, $3, $4, 'invited')
		RETURNING `+memberColumns, orgID, email, name, role), scanMember)
}

func UpdateMember(ctx context.Context, tx pgx.Tx, id string, role, status *string) (*model.Member, error) {
	return one(tx.QueryRow(ctx, `UPDATE members SET role = coalesce($2, role), status = coalesce($3, status)
		WHERE id = $1 RETURNING `+memberColumns, id, role, status), scanMember)
}

func DeleteMember(ctx context.Context, tx pgx.Tx, id string) error {
	return affected(tx.Exec(ctx, `DELETE FROM members WHERE id = $1`, id))
}

// LockOwners locks the org's active owner rows until the transaction ends
// and counts them, so two changes that would each leave one owner cannot
// both pass the last-owner check.
func LockOwners(ctx context.Context, tx pgx.Tx) (int, error) {
	var n int
	err := tx.QueryRow(ctx, `SELECT count(*) FROM (SELECT id FROM members WHERE role = 'owner' AND status = 'active'
		ORDER BY id FOR UPDATE) owners`).Scan(&n)
	return n, err
}
