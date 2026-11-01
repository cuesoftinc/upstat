package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
)

// ── Channels (flows/alert.md §1) ────────────────────────────────────────

const channelColumns = `id, org_id, kind, name, target, secret, health, failure_note, created_at`

func scanChannel(r pgx.Row) (*model.Channel, error) {
	var c model.Channel
	return &c, r.Scan(&c.ID, &c.OrgID, &c.Kind, &c.Name, &c.Target, &c.Secret, &c.Health, &c.FailureNote, &c.CreatedAt)
}

func ListChannels(ctx context.Context, tx pgx.Tx) ([]model.Channel, error) {
	rows, err := tx.Query(ctx, `SELECT `+channelColumns+` FROM channels ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanChannel)
}

func GetChannel(ctx context.Context, tx pgx.Tx, id string) (*model.Channel, error) {
	return one(tx.QueryRow(ctx, `SELECT `+channelColumns+` FROM channels WHERE id = $1`, id), scanChannel)
}

func CreateChannel(ctx context.Context, tx pgx.Tx, orgID string, c model.Channel) (*model.Channel, error) {
	return one(tx.QueryRow(ctx, `INSERT INTO channels (org_id, kind, name, target, secret) VALUES ($1, $2, $3, $4, $5)
		RETURNING `+channelColumns, orgID, c.Kind, c.Name, c.Target, c.Secret), scanChannel)
}

// MarkVerifyRequested stamps a verification send; false when one went out
// within the hourly budget (engineering.md §3: 5/hr per channel, enforced
// as at most one per 12 minutes).
func MarkVerifyRequested(ctx context.Context, tx pgx.Tx, id string, now time.Time) (bool, error) {
	tag, err := tx.Exec(ctx, `UPDATE channels SET verify_requested_at = $2 WHERE id = $1
		AND (verify_requested_at IS NULL OR verify_requested_at < $2::timestamptz - interval '12 minutes')`, id, now)
	return tag.RowsAffected() == 1, err
}

// DeleteChannel deletes a channel and detaches it from every rule.
func DeleteChannel(ctx context.Context, tx pgx.Tx, id string) error {
	if err := affected(tx.Exec(ctx, `DELETE FROM channels WHERE id = $1`, id)); err != nil {
		return err
	}
	_, err := tx.Exec(ctx, `UPDATE rules SET notify = jsonb_set(notify, '{channel_ids}',
			coalesce((SELECT jsonb_agg(c) FROM jsonb_array_elements_text(notify->'channel_ids') c WHERE c <> $1), '[]'))
		WHERE notify->'channel_ids' ? $1`, id)
	return err
}

// RecordChannelOutcome keeps the degraded badge (flows/alert.md §1): five
// consecutive failed deliveries degrade a channel; the first delivered one
// restores it. A delivered verification verifies it.
func RecordChannelOutcome(ctx context.Context, tx pgx.Tx, id, kind, state, note string) error {
	if state == "suppressed" {
		return nil
	}
	if kind == "verify" {
		_, err := tx.Exec(ctx, `UPDATE channels SET
				health = CASE WHEN $2 = 'delivered' THEN 'verified' ELSE health END,
				verified_once = verified_once OR $2 = 'delivered',
				failure_note = CASE WHEN $2 = 'delivered' THEN '' ELSE $3 END
			WHERE id = $1`, id, state, note)
		return err
	}
	_, err := tx.Exec(ctx, `UPDATE channels SET
			consecutive_failures = CASE WHEN $2 = 'delivered' THEN 0 ELSE consecutive_failures + 1 END,
			health = CASE WHEN $2 = 'delivered' AND verified_once THEN 'verified'
				WHEN $2 = 'failed' AND consecutive_failures + 1 >= 5 THEN 'degraded' ELSE health END,
			failure_note = CASE WHEN $2 = 'delivered' THEN '' ELSE $3 END
		WHERE id = $1`, id, state, note)
	return err
}

// ── Rules ───────────────────────────────────────────────────────────────

const ruleColumns = `id, org_id, name, signal, query, query_string, thresholds, notify, state, last_triggered_at`

func scanRule(r pgx.Row) (*model.Rule, error) {
	var m model.Rule
	var query, thresholds, notify []byte
	if err := r.Scan(&m.ID, &m.OrgID, &m.Name, &m.Signal, &query, &m.QueryString, &thresholds, &notify, &m.State, &m.LastTriggeredAt); err != nil {
		return nil, err
	}
	m.Query = json.RawMessage("null")
	if query != nil {
		m.Query = query
	}
	if err := json.Unmarshal(thresholds, &m.Thresholds); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(notify, &m.Notify); err != nil {
		return nil, err
	}
	if m.Notify.ChannelIDs == nil {
		m.Notify.ChannelIDs = []string{}
	}
	if m.Notify.MuteWindows == nil {
		m.Notify.MuteWindows = []model.MuteWindow{}
	}
	return &m, nil
}

func ListRules(ctx context.Context, tx pgx.Tx) ([]model.Rule, error) {
	rows, err := tx.Query(ctx, `SELECT `+ruleColumns+` FROM rules ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanRule)
}

func GetRule(ctx context.Context, tx pgx.Tx, id string) (*model.Rule, error) {
	return one(tx.QueryRow(ctx, `SELECT `+ruleColumns+` FROM rules WHERE id = $1`, id), scanRule)
}

func nullJSON(raw json.RawMessage) any {
	if len(raw) == 0 || string(raw) == "null" {
		return nil
	}
	return []byte(raw)
}

func CreateRule(ctx context.Context, tx pgx.Tx, orgID string, m model.Rule) (*model.Rule, error) {
	return one(tx.QueryRow(ctx, `INSERT INTO rules (org_id, name, signal, query, query_string, thresholds, notify)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING `+ruleColumns,
		orgID, m.Name, m.Signal, nullJSON(m.Query), m.QueryString, mustJSON(m.Thresholds), mustJSON(m.Notify)), scanRule)
}

func UpdateRule(ctx context.Context, tx pgx.Tx, m model.Rule) (*model.Rule, error) {
	return one(tx.QueryRow(ctx, `UPDATE rules SET name = $2, query = $3, query_string = $4, thresholds = $5, notify = $6,
			updated_at = now()
		WHERE id = $1 RETURNING `+ruleColumns,
		m.ID, m.Name, nullJSON(m.Query), m.QueryString, mustJSON(m.Thresholds), mustJSON(m.Notify)), scanRule)
}

func DeleteRule(ctx context.Context, tx pgx.Tx, id string) error {
	return affected(tx.Exec(ctx, `DELETE FROM rules WHERE id = $1`, id))
}

// SetRuleState persists the evaluator's verdict.
func SetRuleState(ctx context.Context, tx pgx.Tx, id, state string, triggered bool, at time.Time) error {
	_, err := tx.Exec(ctx, `UPDATE rules SET state = $2,
			last_triggered_at = CASE WHEN $3 THEN $4 ELSE last_triggered_at END
		WHERE id = $1`, id, state, triggered, at)
	return err
}

// MarkRuleTriggered stamps an uptime rule that notified.
func MarkRuleTriggered(ctx context.Context, tx pgx.Tx, id string, at time.Time, state string) error {
	_, err := tx.Exec(ctx, `UPDATE rules SET last_triggered_at = greatest(coalesce(last_triggered_at, $2), $2), state = $3
		WHERE id = $1`, id, at, state)
	return err
}

// ── Deliveries and the alert feed (MI-14) ───────────────────────────────

type Delivery struct {
	ID, OrgID, Kind, Sev, MonitorName, Message, State string
	TransitionID, RuleID, ChannelID                   *string
	Attempts                                          int
	At                                                time.Time
}

func InsertDelivery(ctx context.Context, tx pgx.Tx, d Delivery) (bool, error) {
	tag, err := tx.Exec(ctx, `INSERT INTO deliveries (id, org_id, transition_id, rule_id, channel_id, kind, sev, monitor_name,
			message, state, attempts, at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT (id) DO NOTHING`,
		d.ID, d.OrgID, d.TransitionID, d.RuleID, d.ChannelID, d.Kind, d.Sev, d.MonitorName, d.Message, d.State, d.Attempts, d.At)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

// AlertFeed is the triggered feed: one row per transition and rule (its
// channels collapse into one line), newest first. Verification sends are
// not alerts.
func AlertFeed(ctx context.Context, tx pgx.Tx, limit int) ([]model.AlertEvent, error) {
	rows, err := tx.Query(ctx, `SELECT DISTINCT ON (coalesce(transition_id::text, id::text), coalesce(rule_id::text, ''))
			id, at, sev, coalesce(rule_id::text, ''), monitor_name, message, read_at IS NULL, state
		FROM deliveries WHERE kind <> 'verify'
		ORDER BY coalesce(transition_id::text, id::text), coalesce(rule_id::text, ''),
			(state = 'delivered') DESC, at DESC`)
	if err != nil {
		return nil, err
	}
	events, err := collect(rows, func(r pgx.Row) (*model.AlertEvent, error) {
		var e model.AlertEvent
		return &e, r.Scan(&e.ID, &e.TS, &e.Sev, &e.RuleID, &e.MonitorName, &e.Message, &e.Unread, &e.State)
	})
	if err != nil {
		return nil, err
	}
	sortEventsDesc(events)
	if len(events) > limit {
		events = events[:limit]
	}
	return events, nil
}

func sortEventsDesc(events []model.AlertEvent) {
	for i := 1; i < len(events); i++ {
		for j := i; j > 0 && events[j].TS.After(events[j-1].TS); j-- {
			events[j], events[j-1] = events[j-1], events[j]
		}
	}
}

func MarkFeedRead(ctx context.Context, tx pgx.Tx) error {
	_, err := tx.Exec(ctx, `UPDATE deliveries SET read_at = now() WHERE read_at IS NULL`)
	return err
}
