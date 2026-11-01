package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/pkg/bus"
)

// Consumers persist the decisions analytics makes (§6.1, §6.2, §6.6).
// Every handler is idempotent: a redelivered message changes nothing.

type transitionMsg struct {
	ID                  string          `json:"id"`
	MonitorID           string          `json:"monitor_id"`
	OrgID               string          `json:"org_id"`
	Seq                 int64           `json:"seq"`
	From                string          `json:"from"`
	To                  string          `json:"to"`
	Cause               string          `json:"cause"`
	At                  time.Time       `json:"at"`
	Regions             map[string]bool `json:"regions"`
	ConsecutiveFailures int             `json:"consecutive_failures"`
}

// OnTransition stores the transition, materializes the monitor's status,
// and opens or closes its auto-incident (flows/monitor.md §2: opened on
// any transition into down, closed on down → up).
func (s *Services) OnTransition(ctx context.Context, data json.RawMessage) error {
	var m transitionMsg
	if err := json.Unmarshal(data, &m); err != nil {
		return fmt.Errorf("%w: %v", bus.ErrContract, err)
	}
	return s.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		t := repository.Transition{ID: m.ID, OrgID: m.OrgID, MonitorID: m.MonitorID, Seq: m.Seq, From: m.From, To: m.To,
			Cause: m.Cause, Regions: m.Regions, ConsecutiveFailures: m.ConsecutiveFailures, At: m.At}
		fresh, err := repository.InsertTransition(ctx, tx, t)
		if errors.Is(err, repository.ErrNotFound) || isForeignKey(err) {
			return nil // the monitor was deleted meanwhile
		}
		if err != nil || !fresh {
			return err
		}
		if _, err := repository.ApplyTransition(ctx, tx, t); err != nil {
			return err
		}
		name, err := repository.MonitorName(ctx, tx, m.MonitorID)
		if errors.Is(err, repository.ErrNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		switch {
		case m.To == "down":
			_, err := repository.OpenMonitorIncident(ctx, tx, m.MonitorID)
			if !errors.Is(err, repository.ErrNotFound) {
				return err // already open (or a read error)
			}
			monitorID := m.MonitorID
			cause := m.Cause
			if cause == "" {
				cause = "failing"
			}
			_, err = repository.CreateIncident(ctx, tx, repository.NewIncident{OrgID: m.OrgID, Title: name + " is down", Sev: 2,
				Commander: "Upstat", Source: "monitor", MonitorID: &monitorID, Cause: cause, StartedAt: m.At,
				FirstEntry: fmt.Sprintf("%s went down (%s) after %d consecutive failed checks", name, cause, m.ConsecutiveFailures)})
			return err
		case m.From == "down" && m.To == "up":
			return s.closeMonitorIncident(ctx, tx, m.MonitorID, name+" recovered")
		}
		return nil
	})
}

func isForeignKey(err error) bool {
	return err != nil && strings.Contains(err.Error(), "23503")
}

type deliveryMsg struct {
	ID           string    `json:"id"`
	OrgID        string    `json:"org_id"`
	Kind         string    `json:"kind"`
	TransitionID *string   `json:"transition_id"`
	RuleID       *string   `json:"rule_id"`
	ChannelID    *string   `json:"channel_id"`
	Sev          string    `json:"sev"`
	MonitorName  string    `json:"monitor_name"`
	Message      string    `json:"message"`
	State        string    `json:"state"`
	Attempts     int       `json:"attempts"`
	At           time.Time `json:"at"`
}

// OnDelivery records a notification outcome: the alert feed, the channel
// health badge, and the rule's last trigger.
func (s *Services) OnDelivery(ctx context.Context, data json.RawMessage) error {
	var m deliveryMsg
	if err := json.Unmarshal(data, &m); err != nil {
		return fmt.Errorf("%w: %v", bus.ErrContract, err)
	}
	if m.Sev == "" {
		m.Sev = "sev2"
	}
	return s.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		fresh, err := repository.InsertDelivery(ctx, tx, repository.Delivery{ID: m.ID, OrgID: m.OrgID, Kind: m.Kind, Sev: m.Sev,
			MonitorName: m.MonitorName, Message: m.Message, State: m.State, TransitionID: m.TransitionID, RuleID: m.RuleID,
			ChannelID: m.ChannelID, Attempts: m.Attempts, At: m.At})
		if err != nil || !fresh {
			return err
		}
		if m.ChannelID != nil {
			note := ""
			if m.State == "failed" {
				note = fmt.Sprintf("Last delivery failed %s — %d attempts exhausted", m.At.Format(time.RFC3339), m.Attempts)
			}
			if err := repository.RecordChannelOutcome(ctx, tx, *m.ChannelID, m.Kind, m.State, note); err != nil {
				return err
			}
			if m.Kind == "verify" {
				if err := configChanged(ctx, tx, "channels"); err != nil {
					return err
				}
			}
		}
		if m.RuleID != nil && m.Kind != "verify" && m.Kind != "rule" && m.State == "delivered" {
			state := "alert"
			if m.Sev == "resolved" {
				state = "ok"
			}
			return repository.MarkRuleTriggered(ctx, tx, *m.RuleID, m.At, state)
		}
		return nil
	})
}

// OnRuleEvaluated persists a metric/log/trace/SLO-burn rule's state.
func (s *Services) OnRuleEvaluated(ctx context.Context, data json.RawMessage) error {
	var m struct {
		RuleID    string    `json:"rule_id"`
		State     string    `json:"state"`
		Triggered bool      `json:"triggered"`
		At        time.Time `json:"at"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return fmt.Errorf("%w: %v", bus.ErrContract, err)
	}
	return s.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		return repository.SetRuleState(ctx, tx, m.RuleID, m.State, m.Triggered, m.At)
	})
}

// OnSLOEvaluated persists an SLO's attainment and budget.
func (s *Services) OnSLOEvaluated(ctx context.Context, data json.RawMessage) error {
	var m struct {
		SLOID              string     `json:"slo_id"`
		Current            float64    `json:"current"`
		BudgetRemainingPct float64    `json:"budget_remaining_pct"`
		BurnRate           float64    `json:"burn_rate"`
		State              string     `json:"state"`
		ExhaustedAt        *time.Time `json:"exhausted_at"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return fmt.Errorf("%w: %v", bus.ErrContract, err)
	}
	return s.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		return repository.SetSLOStatus(ctx, tx, repository.SLOStatus{ID: m.SLOID, State: m.State, Current: m.Current,
			BudgetRemaining: m.BudgetRemainingPct, Burn: m.BurnRate, ExhaustedAt: m.ExhaustedAt})
	})
}

// OnInsight persists an insight analytics generated.
func (s *Services) OnInsight(ctx context.Context, data json.RawMessage) error {
	var m struct {
		model.Insight
		OrgID string `json:"org_id"`
	}
	if err := json.Unmarshal(data, &m); err != nil {
		return fmt.Errorf("%w: %v", bus.ErrContract, err)
	}
	return s.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		return repository.InsertInsight(ctx, tx, m.OrgID, m.Insight)
	})
}

// LogFailure is the consumers' failure recorder: the message is skipped
// and committed after its retries (never block a shared lane).
func LogFailure(event string) bus.Failure {
	return func(ctx context.Context, _ json.RawMessage, cause error) error {
		slog.ErrorContext(ctx, "message skipped after retries", "event", event, "request_id", bus.RequestID(ctx), "error", cause)
		return nil
	}
}
