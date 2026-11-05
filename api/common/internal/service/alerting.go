package service

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/mail"
	"net/url"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/pkg/bus"
	"github.com/cuesoftinc/upstat/api/common/pkg/snapshot"
)

// ── Channels (flows/alert.md §1) ────────────────────────────────────────

type ChannelInput struct {
	Kind   string `json:"kind"`
	Name   string `json:"name"`
	Target string `json:"target"`
	Secret string `json:"secret"`
}

func (s *Services) ListChannels(ctx context.Context, c *Caller) ([]model.Channel, error) {
	var out []model.Channel
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.ListChannels(ctx, tx)
		return err
	})
	return out, err
}

func (s *Services) GetChannel(ctx context.Context, c *Caller, id string) (*model.Channel, error) {
	var out *model.Channel
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.GetChannel(ctx, tx, id)
		return orNotFound(err, "channel")
	})
	return out, err
}

func (s *Services) CreateChannel(ctx context.Context, c *Caller, in ChannelInput) (*model.Channel, error) {
	in.Target = strings.TrimSpace(in.Target)
	switch in.Kind {
	case "webhook":
		u, err := url.Parse(in.Target)
		if err != nil || u.Scheme != "https" || u.Host == "" {
			return nil, invalid("invalid_target", "webhooks must be https URLs")
		}
		if !s.Config.SelfHost && blockedTarget(u.Hostname()) {
			return nil, invalid("target_not_allowed", "private, loopback and metadata addresses can't receive webhooks")
		}
		if in.Secret == "" {
			buf := make([]byte, 24)
			_, _ = rand.Read(buf)
			in.Secret = hex.EncodeToString(buf)
		}
	case "email":
		if _, err := mail.ParseAddress(in.Target); err != nil {
			return nil, invalid("invalid_target", "email channels need an address")
		}
		in.Secret = ""
	default:
		return nil, invalid("bad_shape", "kind and target are required")
	}
	var out *model.Channel
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		var err error
		if out, err = repository.CreateChannel(ctx, tx, c.OrgID, model.Channel{Kind: in.Kind, Name: strings.TrimSpace(in.Name),
			Target: in.Target, Secret: in.Secret}); err != nil {
			return err
		}
		return configChanged(ctx, tx, snapshot.KindChannels)
	})
	return out, err
}

func (s *Services) DeleteChannel(ctx context.Context, c *Caller, id string) error {
	return s.inOrg(ctx, c, "admin", func(tx pgx.Tx) error {
		if err := repository.DeleteChannel(ctx, tx, id); err != nil {
			return orNotFound(err, "channel")
		}
		return configChanged(ctx, tx, snapshot.KindChannels, snapshot.KindRules)
	})
}

// VerifyChannel asks analytics to send the channel its verification
// message; the channel turns verified when that delivery succeeds (a
// webhook answering 2xx, Brevo accepting the email), which comes back as
// an upstat.alerting.delivery.
func (s *Services) VerifyChannel(ctx context.Context, c *Caller, id string) (*model.Channel, error) {
	var out *model.Channel
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		var err error
		if out, err = repository.GetChannel(ctx, tx, id); err != nil {
			return orNotFound(err, "channel")
		}
		now := s.Now().UTC()
		ok, err := repository.MarkVerifyRequested(ctx, tx, id, now)
		if err != nil {
			return err
		}
		if !ok {
			return &Error{Status: 429, Code: "rate_limited", Message: "a verification was sent recently; try again later"}
		}
		// The secret and target must be in the snapshot analytics reads.
		if err := configChanged(ctx, tx, snapshot.KindChannels); err != nil {
			return err
		}
		return repository.Enqueue(ctx, tx, bus.EventVerifyRequested, id, id+":"+now.Format("20060102T150405"),
			map[string]any{"channel_id": id, "org_id": c.OrgID, "requested_at": now})
	})
	return out, err
}

// ── Rules ───────────────────────────────────────────────────────────────

var signals = map[string]bool{"uptime": true, "metric": true, "log": true, "trace": true, "slo_burn": true}

type RuleInput struct {
	Name        *string           `json:"name"`
	Signal      *string           `json:"signal"`
	Query       *json.RawMessage  `json:"query"`
	QueryString *string           `json:"query_string"`
	Thresholds  *model.Thresholds `json:"thresholds"`
	Notify      *model.Notify     `json:"notify"`
}

func defaultNotify() model.Notify {
	return model.Notify{ChannelIDs: []string{}, CooldownMinutes: 30, MuteWindows: []model.MuteWindow{}}
}

func (s *Services) checkRule(ctx context.Context, tx pgx.Tx, r *model.Rule) error {
	r.Name = strings.TrimSpace(r.Name)
	if r.Name == "" || len(r.Name) > 120 {
		return invalid("bad_shape", "name, signal and thresholds are required")
	}
	if !signals[r.Signal] {
		return invalid("bad_shape", "signal must be uptime, metric, log, trace or slo_burn")
	}
	if r.Signal != "uptime" && strings.TrimSpace(r.QueryString) == "" {
		return invalid("bad_shape", "metric, log, trace and slo_burn rules need a query")
	}
	if r.Thresholds.Window == "" {
		r.Thresholds.Window = "5m"
	}
	if r.Notify.CooldownMinutes < 0 || r.Notify.CooldownMinutes > 1440 || r.Notify.RenotifyMinutes < 0 {
		return invalid("bad_shape", "cooldown must be 0-1440 minutes")
	}
	if r.Notify.ChannelIDs == nil {
		r.Notify.ChannelIDs = []string{}
	}
	if r.Notify.MuteWindows == nil {
		r.Notify.MuteWindows = []model.MuteWindow{}
	}
	for _, id := range r.Notify.ChannelIDs {
		ch, err := repository.GetChannel(ctx, tx, id)
		if errors.Is(err, repository.ErrNotFound) {
			return &Error{Status: 404, Code: "not_found", Message: "channel " + id + " not found", Details: map[string]any{"resource": "channel"}}
		}
		if err != nil {
			return err
		}
		if ch.Health == "unverified" {
			return invalid("channel_unverified", "channel "+id+" is not verified")
		}
	}
	return nil
}

func (s *Services) ListRules(ctx context.Context, c *Caller) ([]model.Rule, error) {
	var out []model.Rule
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.ListRules(ctx, tx)
		return err
	})
	return out, err
}

func (s *Services) CreateRule(ctx context.Context, c *Caller, in RuleInput) (*model.Rule, error) {
	if in.Name == nil || in.Signal == nil || in.Thresholds == nil {
		return nil, invalid("bad_shape", "name, signal and thresholds are required")
	}
	r := model.Rule{Name: *in.Name, Signal: *in.Signal, Thresholds: *in.Thresholds, Notify: deref(in.Notify, defaultNotify()),
		QueryString: deref(in.QueryString, "")}
	if in.Query != nil {
		r.Query = *in.Query
	}
	var out *model.Rule
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		if err := s.checkRule(ctx, tx, &r); err != nil {
			return err
		}
		var err error
		if out, err = repository.CreateRule(ctx, tx, c.OrgID, r); err != nil {
			return err
		}
		return configChanged(ctx, tx, snapshot.KindRules)
	})
	return out, err
}

func (s *Services) UpdateRule(ctx context.Context, c *Caller, id string, in RuleInput) (*model.Rule, error) {
	var out *model.Rule
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		cur, err := repository.GetRule(ctx, tx, id)
		if err != nil {
			return orNotFound(err, "rule")
		}
		next := *cur
		next.Name = deref(in.Name, cur.Name)
		next.QueryString = deref(in.QueryString, cur.QueryString)
		next.Thresholds = deref(in.Thresholds, cur.Thresholds)
		next.Notify = deref(in.Notify, cur.Notify)
		if in.Query != nil {
			next.Query = *in.Query
		}
		if err := s.checkRule(ctx, tx, &next); err != nil {
			return err
		}
		if out, err = repository.UpdateRule(ctx, tx, next); err != nil {
			return err
		}
		return configChanged(ctx, tx, snapshot.KindRules)
	})
	return out, err
}

func (s *Services) DeleteRule(ctx context.Context, c *Caller, id string) error {
	return s.inOrg(ctx, c, "admin", func(tx pgx.Tx) error {
		if err := repository.DeleteRule(ctx, tx, id); err != nil {
			return orNotFound(err, "rule")
		}
		return configChanged(ctx, tx, snapshot.KindRules)
	})
}

// TestRule is the MI-9 24 h replay, computed by api/query from the rule's
// query and thresholds.
func (s *Services) TestRule(ctx context.Context, c *Caller, id string) (map[string]any, error) {
	var rule *model.Rule
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		rule, err = repository.GetRule(ctx, tx, id)
		return orNotFound(err, "rule")
	})
	if err != nil {
		return nil, err
	}
	return s.Telemetry.Replay(ctx, c.OrgID, ReplayRequest{Signal: rule.Signal, QueryString: rule.QueryString,
		Thresholds: rule.Thresholds, CooldownMinutes: rule.Notify.CooldownMinutes})
}

// TestMonitor replays a monitor's last 24 h of response times against its
// timeout (the uptime-monitor variant of MI-9).
func (s *Services) TestMonitor(ctx context.Context, c *Caller, id string) (map[string]any, error) {
	m, err := s.GetMonitor(ctx, c, id)
	if err != nil {
		return nil, err
	}
	crit := float64(m.TimeoutSeconds * 1000)
	return s.Telemetry.Replay(ctx, c.OrgID, ReplayRequest{Signal: "uptime", MonitorID: m.ID,
		QueryString: "check:" + m.ID + " | p95(response_time_ms)", Thresholds: model.Thresholds{Crit: crit, Window: "5m"}})
}

// AlertFeed is MI-14.
func (s *Services) AlertFeed(ctx context.Context, c *Caller) ([]model.AlertEvent, error) {
	var out []model.AlertEvent
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.AlertFeed(ctx, tx, 200)
		return err
	})
	return out, err
}

func (s *Services) MarkFeedRead(ctx context.Context, c *Caller) error {
	return s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) error { return repository.MarkFeedRead(ctx, tx) })
}
