package repository

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"sync/atomic"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/pkg/bus"
	"github.com/cuesoftinc/upstat/api/common/pkg/snapshot"
)

type queuedKey struct{}

// Queued records, for the request that owns its context, whether the request
// queued outbox rows; the server publishes them before it answers (S-14).
type Queued struct{ n atomic.Int64 }

func (q *Queued) Any() bool { return q.n.Load() > 0 }

// WithQueued returns a context whose Enqueue calls count on the Queued.
func WithQueued(ctx context.Context) (context.Context, *Queued) {
	q := &Queued{}
	return context.WithValue(ctx, queuedKey{}, q), q
}

// NoteQueued counts one queued row against ctx's Queued, if it has one.
func NoteQueued(ctx context.Context) {
	if q, ok := ctx.Value(queuedKey{}).(*Queued); ok {
		q.n.Add(1)
	}
}

// Enqueue writes an event in the caller's transaction (§6.8): it is sent if
// and only if the business write commits. Empty requestID means a new one.
func Enqueue(ctx context.Context, tx pgx.Tx, event, key, requestID string, data any) error {
	NoteQueued(ctx)
	_, err := tx.Exec(ctx, `INSERT INTO outbox (event, message_key, payload, request_id)
		VALUES ($1, $2, $3, coalesce(nullif($4, ''), gen_random_uuid()::text))`, event, key, mustJSON(data), requestID)
	return err
}

// ConfigChanged queues a snapshot rewrite of kind. The publisher builds
// the snapshot when it sends the row, so a burst of writes yields one
// rewrite per batch with the latest state.
func ConfigChanged(ctx context.Context, tx pgx.Tx, kind string) error {
	return Enqueue(ctx, tx, bus.EventConfigChanged, kind, "", map[string]string{"kind": kind})
}

type OutboxRow struct {
	ID        int64
	Event     string
	Key       string
	RequestID string
	Payload   json.RawMessage
}

// LeaseOutbox takes up to limit unsent rows whose lease is free or lapsed and
// leases them to owner for `lease`; concurrent publishers skip each other's
// rows (SKIP LOCKED) and the statement holds no lock after it returns. Rows
// parked as failed are not taken, nor are config.changed rows of a kind whose
// snapshot another pass holds: they would only fill the batch while it waits.
func LeaseOutbox(ctx context.Context, tx pgx.Tx, limit int, lease time.Duration, owner string) ([]OutboxRow, error) {
	rows, err := tx.Query(ctx, `UPDATE outbox SET lease_until = now() + make_interval(secs => $2), lease_owner = $3
		WHERE id IN (SELECT id FROM outbox WHERE published_at IS NULL AND failed_at IS NULL
			AND (lease_until IS NULL OR lease_until < now())
			AND NOT (event = $4 AND EXISTS (SELECT 1 FROM config_snapshot s WHERE s.kind = outbox.message_key AND s.lease_until > now()))
			ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED)
		RETURNING id, event, message_key, request_id, payload`, limit, lease.Seconds(), owner, bus.EventConfigChanged)
	if err != nil {
		return nil, err
	}
	out, err := collect(rows, func(r pgx.Row) (*OutboxRow, error) {
		var o OutboxRow
		return &o, r.Scan(&o.ID, &o.Event, &o.Key, &o.RequestID, &o.Payload)
	})
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, err
}

// ReleaseOutbox frees owner's lease on rows that were not sent, so the next
// pass retries them in order. Rows another pass has leased since are left alone.
func ReleaseOutbox(ctx context.Context, tx pgx.Tx, ids []int64, owner string) error {
	_, err := tx.Exec(ctx, `UPDATE outbox SET lease_until = NULL, lease_owner = NULL
		WHERE id = ANY($1) AND published_at IS NULL AND lease_owner = $2`, ids, owner)
	return err
}

// MarkPublished marks owner's rows sent; a row another pass leased after
// owner's lease lapsed is left to that pass.
func MarkPublished(ctx context.Context, tx pgx.Tx, ids []int64, owner string) error {
	_, err := tx.Exec(ctx, `UPDATE outbox SET published_at = now(), lease_until = NULL, lease_owner = NULL
		WHERE id = ANY($1) AND lease_owner = $2`, ids, owner)
	return err
}

// MarkFailedOutbox parks a row that can never be sent, with the cause; it
// stays in the table for diagnosis and for RequeueFailedOutbox. Only the pass
// that leased the row (owner) parks it.
func MarkFailedOutbox(ctx context.Context, tx pgx.Tx, id int64, cause, owner string) error {
	_, err := tx.Exec(ctx, `UPDATE outbox SET failed_at = now(), failure = $2, attempts = attempts + 1, lease_until = NULL, lease_owner = NULL
		WHERE id = $1 AND lease_owner = $3`, id, cause, owner)
	return err
}

// RequeueFailedOutbox puts rows that failed under maxAttempts times, longer
// than wait ago, back in the queue (a fix may have shipped since); it
// returns how many.
func RequeueFailedOutbox(ctx context.Context, tx pgx.Tx, maxAttempts int, wait time.Duration) (int64, error) {
	tag, err := tx.Exec(ctx, `UPDATE outbox SET failed_at = NULL WHERE published_at IS NULL AND failed_at IS NOT NULL
		AND attempts < $1 AND failed_at < now() - make_interval(secs => $2)`, maxAttempts, wait.Seconds())
	return tag.RowsAffected(), err
}

// PruneOutbox deletes published rows older than olderThan, and failed rows
// older than failedFor.
func PruneOutbox(ctx context.Context, tx pgx.Tx, olderThan, failedFor time.Duration) (int64, error) {
	tag, err := tx.Exec(ctx, `DELETE FROM outbox WHERE published_at < now() - make_interval(secs => $1)
		OR (published_at IS NULL AND failed_at < now() - make_interval(secs => $2))`, olderThan.Seconds(), failedFor.Seconds())
	return tag.RowsAffected(), err
}

// PendingOutbox counts unsent rows that are still being tried.
func PendingOutbox(ctx context.Context, tx pgx.Tx) (int, error) {
	var n int
	return n, tx.QueryRow(ctx, `SELECT count(*) FROM outbox WHERE published_at IS NULL AND failed_at IS NULL`).Scan(&n)
}

// FailedOutbox counts rows parked as failed.
func FailedOutbox(ctx context.Context, tx pgx.Tx) (int, error) {
	var n int
	return n, tx.QueryRow(ctx, `SELECT count(*) FROM outbox WHERE published_at IS NULL AND failed_at IS NOT NULL`).Scan(&n)
}

// LockSnapshots takes the per-kind advisory locks an older revision's
// publisher holds across its whole rewrite, in sorted order so two publishers
// cannot deadlock, until tx ends. A pass takes them while it claims, so it
// waits for an older revision's rewrite in flight and then sees what it
// stored. The wait is bounded.
func LockSnapshots(ctx context.Context, tx pgx.Tx, kinds ...string) error {
	if len(kinds) == 0 {
		return nil
	}
	if _, err := tx.Exec(ctx, `SET LOCAL lock_timeout = '10s'`); err != nil {
		return err
	}
	sorted := append([]string(nil), kinds...)
	sort.Strings(sorted)
	for _, kind := range sorted {
		if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('snapshot:' || $1))`, kind); err != nil {
			return err
		}
	}
	return nil
}

// LeaseSnapshot claims kind for one rewrite by owner. It returns the version
// to write, above every version handed out before and at least floor, and
// ok = false while another pass holds the kind. The lease lapses on its own if
// the pass dies; ReleaseSnapshots frees it earlier.
func LeaseSnapshot(ctx context.Context, tx pgx.Tx, kind string, floor int64, lease time.Duration, owner string) (version int64, ok bool, err error) {
	err = tx.QueryRow(ctx, `INSERT INTO config_snapshot (kind, version, lease_until, lease_owner) VALUES ($1, $2, now() + make_interval(secs => $3), $4)
		ON CONFLICT (kind) DO UPDATE SET version = greatest(config_snapshot.version + 1, EXCLUDED.version), lease_until = EXCLUDED.lease_until,
				lease_owner = EXCLUDED.lease_owner
			WHERE config_snapshot.lease_until IS NULL OR config_snapshot.lease_until < now()
		RETURNING version`, kind, floor, lease.Seconds(), owner).Scan(&version)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, false, nil
	}
	return version, err == nil, err
}

// ReleaseSnapshots frees owner's leases on the kinds, one statement per kind
// in sorted order (the order LeaseSnapshot takes them in, so two passes cannot
// deadlock). A kind another pass leased since is left alone.
func ReleaseSnapshots(ctx context.Context, tx pgx.Tx, kinds []string, owner string) error {
	sorted := append([]string(nil), kinds...)
	sort.Strings(sorted)
	for _, kind := range sorted {
		if _, err := tx.Exec(ctx, `UPDATE config_snapshot SET lease_until = NULL, lease_owner = NULL WHERE kind = $1 AND lease_owner = $2`, kind, owner); err != nil {
			return err
		}
	}
	return nil
}

// ClaimResult reports whether this is the first result for requestID; it
// is claimed in the caller's transaction.
func ClaimResult(ctx context.Context, tx pgx.Tx, requestID, event string) (bool, error) {
	if requestID == "" {
		return true, nil
	}
	tag, err := tx.Exec(ctx, `INSERT INTO result_claim (request_id, event) VALUES ($1, $2) ON CONFLICT DO NOTHING`, requestID, event)
	return tag.RowsAffected() > 0, err
}

func PruneClaims(ctx context.Context, tx pgx.Tx, olderThan time.Duration) (int64, error) {
	tag, err := tx.Exec(ctx, `DELETE FROM result_claim WHERE claimed_at < now() - make_interval(secs => $1)`, olderThan.Seconds())
	return tag.RowsAffected(), err
}

// ── Snapshot builders (system reads, one per config kind) ───────────────

// SnapshotItems reads the current state of one config kind.
func SnapshotItems(ctx context.Context, tx pgx.Tx, kind string) (any, error) {
	switch kind {
	case snapshot.KindOrgs:
		rows, err := tx.Query(ctx, `SELECT id, name, timezone FROM orgs ORDER BY id`)
		if err != nil {
			return nil, err
		}
		return collect(rows, func(r pgx.Row) (*snapshot.Org, error) {
			var o snapshot.Org
			return &o, r.Scan(&o.ID, &o.Name, &o.Timezone)
		})
	case snapshot.KindMembers:
		rows, err := tx.Query(ctx, `SELECT u.id, coalesce(u.active_org_id::text, ''),
				coalesce(jsonb_agg(jsonb_build_object('org_id', m.org_id, 'role', m.role)) FILTER (WHERE m.id IS NOT NULL), '[]')
			FROM users u LEFT JOIN members m ON m.user_id = u.id AND m.status = 'active'
			GROUP BY u.id ORDER BY u.id`)
		if err != nil {
			return nil, err
		}
		return collect(rows, func(r pgx.Row) (*snapshot.UserAccess, error) {
			var u snapshot.UserAccess
			var memberships []byte
			if err := r.Scan(&u.UserID, &u.ActiveOrgID, &memberships); err != nil {
				return nil, err
			}
			return &u, json.Unmarshal(memberships, &u.Memberships)
		})
	case snapshot.KindIngestKeys:
		rows, err := tx.Query(ctx, `SELECT id, org_id, kind, scope, key_hash, coalesce(previous_hash, ''), previous_expires_at, status,
				allowed_origins, quotas FROM ingest_keys WHERE status <> 'revoked' ORDER BY id`)
		if err != nil {
			return nil, err
		}
		return collect(rows, func(r pgx.Row) (*snapshot.IngestKey, error) {
			var k snapshot.IngestKey
			var origins, quotas []byte
			if err := r.Scan(&k.ID, &k.OrgID, &k.Kind, &k.Scope, &k.Hash, &k.PreviousHash, &k.PreviousExpiresAt, &k.Status, &origins, &quotas); err != nil {
				return nil, err
			}
			if err := json.Unmarshal(origins, &k.AllowedOrigins); err != nil {
				return nil, err
			}
			return &k, json.Unmarshal(quotas, &k.Quotas)
		})
	case snapshot.KindMonitors:
		rows, err := tx.Query(ctx, `SELECT id, org_id, name, target, interval_s, timeout_s, failure_threshold, regions, min_failing_regions,
				active, muted, status, consecutive_failures, last_transition_seq FROM monitors ORDER BY id`)
		if err != nil {
			return nil, err
		}
		return collect(rows, func(r pgx.Row) (*snapshot.Monitor, error) {
			var m snapshot.Monitor
			return &m, r.Scan(&m.ID, &m.OrgID, &m.Name, &m.Target, &m.IntervalS, &m.TimeoutS, &m.FailureThreshold, &m.Regions,
				&m.MinFailingRegions, &m.Active, &m.Muted, &m.Status, &m.ConsecutiveFailures, &m.LastTransitionSeq)
		})
	case snapshot.KindRules:
		rows, err := tx.Query(ctx, `SELECT id, org_id, name, signal, coalesce(query, 'null'), query_string, thresholds, notify, state
			FROM rules ORDER BY id`)
		if err != nil {
			return nil, err
		}
		return collect(rows, func(r pgx.Row) (*snapshot.Rule, error) {
			var m snapshot.Rule
			var query, thresholds, notify []byte
			if err := r.Scan(&m.ID, &m.OrgID, &m.Name, &m.Signal, &query, &m.QueryString, &thresholds, &notify, &m.State); err != nil {
				return nil, err
			}
			m.Query, m.Thresholds, m.Notify = query, thresholds, notify
			return &m, nil
		})
	case snapshot.KindChannels:
		rows, err := tx.Query(ctx, `SELECT id, org_id, kind, name, target, secret, health FROM channels ORDER BY id`)
		if err != nil {
			return nil, err
		}
		return collect(rows, func(r pgx.Row) (*snapshot.Channel, error) {
			var c snapshot.Channel
			return &c, r.Scan(&c.ID, &c.OrgID, &c.Kind, &c.Name, &c.Target, &c.Secret, &c.Health)
		})
	case snapshot.KindRegistry:
		rows, err := tx.Query(ctx, `SELECT org_id, name, dims, unique_ineligible FROM event_registry ORDER BY org_id, name`)
		if err != nil {
			return nil, err
		}
		return collect(rows, func(r pgx.Row) (*snapshot.RegistryEvent, error) {
			var e snapshot.RegistryEvent
			return &e, r.Scan(&e.OrgID, &e.Name, &e.Dims, &e.UniqueIneligible)
		})
	case snapshot.KindSLOs:
		rows, err := tx.Query(ctx, `SELECT id, org_id, name, sli_source, target, window_spec, coalesce(monitor_id::text, ''), query, state
			FROM slos ORDER BY id`)
		if err != nil {
			return nil, err
		}
		return collect(rows, func(r pgx.Row) (*snapshot.SLO, error) {
			var s snapshot.SLO
			return &s, r.Scan(&s.ID, &s.OrgID, &s.Name, &s.SLISource, &s.Target, &s.Window, &s.MonitorID, &s.Query, &s.State)
		})
	}
	return nil, nil
}
