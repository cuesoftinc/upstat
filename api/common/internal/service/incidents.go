package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/pkg/store"
)

var phases = map[string]bool{"investigating": true, "identified": true, "monitoring": true, "resolved": true}

type IncidentInput struct {
	Title     *string              `json:"title"`
	Sev       *int                 `json:"sev"`
	Commander *string              `json:"commander"`
	Status    *string              `json:"status"`
	Roles     *model.IncidentRoles `json:"roles"`
	Services  *[]string            `json:"services"`
}

func (s *Services) ListIncidents(ctx context.Context, c *Caller) ([]model.Incident, error) {
	var out []model.Incident
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.ListIncidents(ctx, tx)
		return err
	})
	return out, err
}

func (s *Services) GetIncident(ctx context.Context, c *Caller, id string) (*model.Incident, error) {
	var out *model.Incident
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.GetIncident(ctx, tx, id)
		return orNotFound(err, "incident")
	})
	return out, err
}

func (s *Services) DeclareIncident(ctx context.Context, c *Caller, in IncidentInput) (*model.Incident, error) {
	title, commander := strings.TrimSpace(deref(in.Title, "")), strings.TrimSpace(deref(in.Commander, ""))
	if title == "" || in.Sev == nil || commander == "" {
		return nil, invalid("bad_shape", "title, sev and commander are required")
	}
	if *in.Sev < 1 || *in.Sev > 4 {
		return nil, invalid("bad_shape", "sev must be 1..4")
	}
	var out *model.Incident
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) (err error) {
		out, err = repository.CreateIncident(ctx, tx, repository.NewIncident{OrgID: c.OrgID, Title: title, Sev: *in.Sev,
			Commander: commander, Source: "manual", StartedAt: s.Now().UTC(), Services: deref(in.Services, nil),
			FirstEntry: fmt.Sprintf("Declared SEV-%d: %s", *in.Sev, title)})
		return err
	})
	return out, err
}

func (s *Services) UpdateIncident(ctx context.Context, c *Caller, id string, in IncidentInput) (*model.Incident, error) {
	if in.Status != nil && !phases[*in.Status] {
		return nil, invalid("bad_shape", "status must be investigating, identified, monitoring or resolved")
	}
	if in.Sev != nil && (*in.Sev < 1 || *in.Sev > 4) {
		return nil, invalid("bad_shape", "sev must be 1..4")
	}
	var out *model.Incident
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) (err error) {
		out, err = repository.UpdateIncident(ctx, tx, id, repository.IncidentPatch{Title: in.Title, Sev: in.Sev, Status: in.Status,
			Roles: in.Roles, Services: in.Services}, s.Now().UTC())
		return orNotFound(err, "incident")
	})
	return out, err
}

func (s *Services) Timeline(ctx context.Context, c *Caller, id string) ([]model.TimelineEntry, error) {
	var out []model.TimelineEntry
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) error {
		if _, err := repository.GetIncident(ctx, tx, id); err != nil {
			return orNotFound(err, "incident")
		}
		var err error
		out, err = repository.Timeline(ctx, tx, id, true)
		return err
	})
	return out, err
}

type TimelineInput struct {
	Phase  *string `json:"phase"`
	Body   string  `json:"body"`
	Author string  `json:"author"`
	// Public posts the update to the public status page; entries are internal by default.
	Public bool `json:"public"`
}

// AddTimeline posts an update; a new phase moves the incident with it.
func (s *Services) AddTimeline(ctx context.Context, c *Caller, id string, in TimelineInput) (*model.TimelineEntry, error) {
	if strings.TrimSpace(in.Body) == "" || strings.TrimSpace(in.Author) == "" {
		return nil, invalid("bad_shape", "body and author are required")
	}
	if in.Phase != nil && !phases[*in.Phase] {
		return nil, invalid("bad_shape", "phase must be investigating, identified, monitoring or resolved")
	}
	var out *model.TimelineEntry
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		inc, err := repository.GetIncident(ctx, tx, id)
		if err != nil {
			return orNotFound(err, "incident")
		}
		phase := deref(in.Phase, inc.Status)
		now := s.Now().UTC()
		if out, err = repository.AddTimeline(ctx, tx, c.OrgID, id, in.Author, phase, in.Body, now, in.Public); err != nil {
			return err
		}
		if phase != inc.Status {
			_, err = repository.UpdateIncident(ctx, tx, id, repository.IncidentPatch{Status: &phase}, now)
		}
		return err
	})
	return out, err
}

// postmortemKey is where a postmortem body lives in storage (§5.1).
func (s *Services) postmortemKey(orgID, incidentID string) string {
	return fmt.Sprintf("%s/postmortems/%s/%s.json", s.Store.Prefix(), orgID, incidentID)
}

func (s *Services) GetPostmortem(ctx context.Context, c *Caller, id string) (*model.Postmortem, error) {
	if _, err := s.GetIncident(ctx, c, id); err != nil {
		return nil, err
	}
	raw, err := s.Store.Get(ctx, s.postmortemKey(c.OrgID, id))
	if errors.Is(err, store.ErrMissing) {
		return nil, notFound("postmortem")
	}
	if err != nil {
		return nil, err
	}
	var pm model.Postmortem
	return &pm, json.Unmarshal(raw, &pm)
}

type PostmortemInput struct {
	Author      string   `json:"author"`
	Impact      *string  `json:"impact"`
	RootCause   *string  `json:"root_cause"`
	ActionItems []string `json:"action_items"`
}

// SavePostmortem composes the B9 document, freezing the timeline as it is
// now, stores it and points the incident at it. created reports a first save.
func (s *Services) SavePostmortem(ctx context.Context, c *Caller, id string, in PostmortemInput) (pm *model.Postmortem, created bool, err error) {
	if strings.TrimSpace(in.Author) == "" || in.Impact == nil || in.RootCause == nil || in.ActionItems == nil {
		return nil, false, invalid("bad_shape", "author, impact, root_cause and action_items[] are required")
	}
	key := s.postmortemKey(c.OrgID, id)
	err = s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		inc, err := repository.GetIncident(ctx, tx, id)
		if err != nil {
			return orNotFound(err, "incident")
		}
		if inc.Status != "resolved" {
			return invalid("incident_not_resolved", "postmortems attach to resolved incidents")
		}
		entries, err := repository.Timeline(ctx, tx, id, false)
		if err != nil {
			return err
		}
		now := s.Now().UTC()
		pm = &model.Postmortem{IncidentID: id, Title: inc.Key + " — " + inc.Title, Author: in.Author, CreatedAt: now, UpdatedAt: now,
			Impact: *in.Impact, RootCause: *in.RootCause, ActionItems: []string{}, Timeline: []model.PostmortemEvent{}}
		if prev, err := s.Store.Get(ctx, key); err == nil {
			var old model.Postmortem
			if json.Unmarshal(prev, &old) == nil {
				pm.CreatedAt = old.CreatedAt
			}
		} else if errors.Is(err, store.ErrMissing) {
			created = true
		} else {
			return err
		}
		for _, item := range in.ActionItems {
			if strings.TrimSpace(item) != "" {
				pm.ActionItems = append(pm.ActionItems, item)
			}
		}
		for _, e := range entries {
			pm.Timeline = append(pm.Timeline, model.PostmortemEvent{TS: e.TS, Phase: e.Phase, Author: e.Author, Body: e.Body})
		}
		raw, err := json.Marshal(pm)
		if err != nil {
			return err
		}
		if err := s.Store.Put(ctx, key, raw, "application/json"); err != nil {
			return err
		}
		_, err = repository.UpdateIncident(ctx, tx, id, repository.IncidentPatch{PostmortemKey: &key}, now)
		return err
	})
	return pm, created, err
}

// closeMonitorIncident resolves a monitor's open auto-incident with a
// final timeline entry; no open incident is fine.
func (s *Services) closeMonitorIncident(ctx context.Context, tx pgx.Tx, monitorID, body string) error {
	inc, err := repository.OpenMonitorIncident(ctx, tx, monitorID)
	if errors.Is(err, repository.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	now := s.Now().UTC()
	resolved := "resolved"
	if _, err := repository.AddTimeline(ctx, tx, inc.OrgID, inc.ID, "Upstat", resolved, body, now, true); err != nil {
		return err
	}
	_, err = repository.UpdateIncident(ctx, tx, inc.ID, repository.IncidentPatch{Status: &resolved}, now)
	return err
}
