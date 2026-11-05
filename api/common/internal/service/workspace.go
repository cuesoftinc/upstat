package service

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/pkg/snapshot"
)

// ── SLOs (pages.md B10) ─────────────────────────────────────────────────

var sliSources = map[string]bool{"check": true, "metric_ratio": true, "latency": true}
var windowRe = regexp.MustCompile(`^[1-9][0-9]?d$`)

func (s *Services) ListSLOs(ctx context.Context, c *Caller) ([]model.SLO, error) {
	var out []model.SLO
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.ListSLOs(ctx, tx)
		return err
	})
	return out, err
}

type SLOInput struct {
	Name      string   `json:"name"`
	SLISource string   `json:"sli_source"`
	Target    *float64 `json:"target"`
	Window    string   `json:"window"`
	MonitorID *string  `json:"monitor_id"`
	Query     string   `json:"query"`
}

func (s *Services) CreateSLO(ctx context.Context, c *Caller, in SLOInput) (*model.SLO, error) {
	if strings.TrimSpace(in.Name) == "" || !sliSources[in.SLISource] || in.Target == nil {
		return nil, invalid("bad_shape", "name, sli_source and target are required")
	}
	if *in.Target <= 0 || *in.Target >= 100 {
		return nil, invalid("bad_shape", "target is a percentage between 0 and 100")
	}
	if in.Window == "" {
		in.Window = "30d"
	}
	if !windowRe.MatchString(in.Window) {
		return nil, invalid("bad_shape", "window is a rolling number of days, like 30d")
	}
	var out *model.SLO
	err := s.inOrg(ctx, c, "admin", func(tx pgx.Tx) error {
		if in.MonitorID != nil {
			if _, err := repository.GetMonitor(ctx, tx, *in.MonitorID); err != nil {
				return orNotFound(err, "monitor")
			}
		}
		var err error
		if out, err = repository.CreateSLO(ctx, tx, c.OrgID, model.SLO{Name: strings.TrimSpace(in.Name), SLISource: in.SLISource,
			Target: *in.Target, Window: in.Window, MonitorID: in.MonitorID, Query: in.Query}); err != nil {
			return err
		}
		return configChanged(ctx, tx, snapshot.KindSLOs)
	})
	return out, err
}

func (s *Services) DeleteSLO(ctx context.Context, c *Caller, id string) error {
	return s.inOrg(ctx, c, "admin", func(tx pgx.Tx) error {
		if err := repository.DeleteSLO(ctx, tx, id); err != nil {
			return orNotFound(err, "slo")
		}
		return configChanged(ctx, tx, snapshot.KindSLOs)
	})
}

// ── Dashboards ──────────────────────────────────────────────────────────

func (s *Services) ListDashboards(ctx context.Context, c *Caller) ([]model.Dashboard, error) {
	var out []model.Dashboard
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.ListDashboards(ctx, tx)
		return err
	})
	return out, err
}

func (s *Services) GetDashboard(ctx context.Context, c *Caller, id string) (*model.Dashboard, error) {
	var out *model.Dashboard
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.GetDashboard(ctx, tx, id)
		return orNotFound(err, "dashboard")
	})
	return out, err
}

func (s *Services) CreateDashboard(ctx context.Context, c *Caller, name string) (*model.Dashboard, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, invalid("bad_shape", "name is required")
	}
	var out *model.Dashboard
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) (err error) {
		out, err = repository.CreateDashboard(ctx, tx, c.OrgID, name)
		if errors.Is(err, repository.ErrConflict) {
			return conflict("name_taken", "a dashboard with this name exists")
		}
		return err
	})
	return out, err
}

type DashboardInput struct {
	Name         *string              `json:"name"`
	Favorite     *bool                `json:"favorite"`
	Shared       *bool                `json:"shared"`
	TemplateVars *map[string][]string `json:"template_vars"`
}

func (s *Services) UpdateDashboard(ctx context.Context, c *Caller, id string, in DashboardInput) (*model.Dashboard, error) {
	var out *model.Dashboard
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		err := repository.UpdateDashboard(ctx, tx, id, repository.DashboardPatch{Name: in.Name, Favorite: in.Favorite, Shared: in.Shared,
			TemplateVars: in.TemplateVars})
		if errors.Is(err, repository.ErrConflict) {
			return conflict("name_taken", "a dashboard with this name exists")
		}
		if err != nil {
			return orNotFound(err, "dashboard")
		}
		out, err = repository.GetDashboard(ctx, tx, id)
		return err
	})
	return out, err
}

func (s *Services) DeleteDashboard(ctx context.Context, c *Caller, id string) error {
	return s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		return orNotFound(repository.DeleteDashboard(ctx, tx, id), "dashboard")
	})
}

var widgetTypes = map[string]bool{"timeseries": true, "query_value": true, "toplist": true, "table": true, "heatmap": true,
	"logstream": true, "trace_latency": true, "slo": true, "status": true, "servicemap": true, "markdown": true}

type WidgetInput struct {
	Type        *string             `json:"type"`
	Title       *string             `json:"title"`
	Query       *json.RawMessage    `json:"query"`
	QueryString *string             `json:"query_string"`
	VizOptions  *json.RawMessage    `json:"viz_options"`
	Layout      *model.WidgetLayout `json:"layout"`
}

func checkLayout(l model.WidgetLayout) error {
	if l.X < 0 || l.Y < 0 || l.W < 1 || l.H < 1 || l.X+l.W > 12 {
		return invalid("bad_shape", "layout must fit the 12-column grid")
	}
	return nil
}

func (s *Services) AddWidget(ctx context.Context, c *Caller, dashboardID string, in WidgetInput) (*model.Widget, error) {
	if in.Type == nil || !widgetTypes[*in.Type] {
		return nil, invalid("bad_shape", "widget type is required")
	}
	w := model.Widget{DashboardID: dashboardID, Type: *in.Type, Title: deref(in.Title, ""), QueryString: in.QueryString,
		Query: json.RawMessage("null"), VizOptions: json.RawMessage("{}"), Layout: deref(in.Layout, model.WidgetLayout{W: 4, H: 3})}
	if in.Query != nil {
		w.Query = *in.Query
	}
	if in.VizOptions != nil && string(*in.VizOptions) != "null" {
		w.VizOptions = *in.VizOptions
	}
	if err := checkLayout(w.Layout); err != nil {
		return nil, err
	}
	var out *model.Widget
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		if err := repository.TouchDashboard(ctx, tx, dashboardID); err != nil {
			return orNotFound(err, "dashboard")
		}
		var err error
		out, err = repository.CreateWidget(ctx, tx, c.OrgID, w)
		return err
	})
	return out, err
}

func (s *Services) UpdateWidget(ctx context.Context, c *Caller, dashboardID, id string, in WidgetInput) (*model.Widget, error) {
	var out *model.Widget
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		if err := repository.TouchDashboard(ctx, tx, dashboardID); err != nil {
			return orNotFound(err, "dashboard")
		}
		w, err := repository.GetWidget(ctx, tx, dashboardID, id)
		if err != nil {
			return orNotFound(err, "widget")
		}
		if in.Type != nil {
			if !widgetTypes[*in.Type] {
				return invalid("bad_shape", "unknown widget type")
			}
			w.Type = *in.Type
		}
		w.Title = deref(in.Title, w.Title)
		if in.Query != nil {
			w.Query = *in.Query
		}
		if in.QueryString != nil {
			w.QueryString = in.QueryString
		}
		if in.VizOptions != nil {
			w.VizOptions = *in.VizOptions
		}
		w.Layout = deref(in.Layout, w.Layout)
		if err := checkLayout(w.Layout); err != nil {
			return err
		}
		out, err = repository.SaveWidget(ctx, tx, *w)
		return err
	})
	return out, err
}

func (s *Services) DeleteWidget(ctx context.Context, c *Caller, dashboardID, id string) error {
	return s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		if err := repository.TouchDashboard(ctx, tx, dashboardID); err != nil {
			return orNotFound(err, "dashboard")
		}
		return orNotFound(repository.DeleteWidget(ctx, tx, dashboardID, id), "widget")
	})
}

// ── Saved views (MI-18) ─────────────────────────────────────────────────

func (s *Services) ListViews(ctx context.Context, c *Caller, surface string) ([]model.SavedView, error) {
	var out []model.SavedView
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.ListViews(ctx, tx, c.UserID, surface)
		return err
	})
	return out, err
}

func (s *Services) CreateView(ctx context.Context, c *Caller, v model.SavedView) (*model.SavedView, error) {
	v.Name = strings.TrimSpace(v.Name)
	if v.Name == "" || v.Query == "" || (v.Surface != "logs" && v.Surface != "metrics" && v.Surface != "traces") {
		return nil, invalid("bad_shape", "name, surface and query are required")
	}
	if v.Scope == "" {
		v.Scope = "personal"
	}
	if v.Scope != "personal" && v.Scope != "org" {
		return nil, invalid("bad_shape", "scope must be personal or org")
	}
	var out *model.SavedView
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.CreateView(ctx, tx, c.OrgID, c.UserID, v)
		if errors.Is(err, repository.ErrConflict) {
			return conflict("name_taken", "a view with this name exists on this surface")
		}
		return err
	})
	return out, err
}

func (s *Services) DeleteView(ctx context.Context, c *Caller, id string) error {
	return s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) error {
		return orNotFound(repository.DeleteView(ctx, tx, c.UserID, id), "view")
	})
}

// ── Service catalog (B11) ───────────────────────────────────────────────

// ListCatalog fills each entry's telemetry presence from api/query; when
// query is unreachable the entries still list, with no presence.
func (s *Services) ListCatalog(ctx context.Context, c *Caller) ([]model.CatalogEntry, error) {
	var out []model.CatalogEntry
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.ListCatalog(ctx, tx)
		return err
	})
	if err != nil || len(out) == 0 || s.Telemetry == nil {
		return out, err
	}
	names := make([]string, len(out))
	for i, e := range out {
		names[i] = e.Name
	}
	qctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	presence, perr := s.Telemetry.Presence(qctx, c.OrgID, names)
	if perr != nil {
		slog.WarnContext(ctx, "telemetry presence unavailable", "error", perr)
		return out, nil
	}
	for i := range out {
		p := presence[out[i].Name]
		out[i].Telemetry = model.TelemetryPresence{Metrics: p.Metrics, Logs: p.Logs, Traces: p.Traces, RUM: p.RUM}
	}
	return out, nil
}

func (s *Services) checkCatalog(e *model.CatalogEntry) error {
	e.Name = strings.TrimSpace(e.Name)
	if e.Name == "" {
		return invalid("bad_shape", "name is required")
	}
	if e.Environments == nil {
		e.Environments = []string{}
	}
	return nil
}

func (s *Services) CreateCatalog(ctx context.Context, c *Caller, e model.CatalogEntry) (*model.CatalogEntry, error) {
	if err := s.checkCatalog(&e); err != nil {
		return nil, err
	}
	var out *model.CatalogEntry
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) (err error) {
		out, err = repository.CreateCatalog(ctx, tx, c.OrgID, e)
		if errors.Is(err, repository.ErrConflict) {
			return conflict("name_taken", "a service with this name exists")
		}
		return err
	})
	return out, err
}

type CatalogInput struct {
	Name         *string             `json:"name"`
	Owner        *string             `json:"owner"`
	Links        *model.CatalogLinks `json:"links"`
	Environments *[]string           `json:"environments"`
}

func (s *Services) UpdateCatalog(ctx context.Context, c *Caller, id string, in CatalogInput) (*model.CatalogEntry, error) {
	var out *model.CatalogEntry
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		cur, err := repository.GetCatalog(ctx, tx, id)
		if err != nil {
			return orNotFound(err, "service")
		}
		cur.Name, cur.Owner = deref(in.Name, cur.Name), deref(in.Owner, cur.Owner)
		cur.Links, cur.Environments = deref(in.Links, cur.Links), deref(in.Environments, cur.Environments)
		if err := s.checkCatalog(cur); err != nil {
			return err
		}
		out, err = repository.UpdateCatalog(ctx, tx, *cur)
		if errors.Is(err, repository.ErrConflict) {
			return conflict("name_taken", "a service with this name exists")
		}
		return err
	})
	return out, err
}

func (s *Services) DeleteCatalog(ctx context.Context, c *Caller, id string) error {
	return s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		return orNotFound(repository.DeleteCatalog(ctx, tx, id), "service")
	})
}

// ── Status page (B7) ────────────────────────────────────────────────────

var slugRe = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{1,62}$`)

func (s *Services) StatusPageConfig(ctx context.Context, c *Caller) (*model.StatusPageConfig, error) {
	var out *model.StatusPageConfig
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) error {
		var err error
		out, err = repository.StatusPageConfig(ctx, tx)
		if errors.Is(err, repository.ErrNotFound) {
			org, oerr := repository.OrgByID(ctx, tx, c.OrgID)
			if oerr != nil {
				return oerr
			}
			out, err = &model.StatusPageConfig{Name: org.Name, Components: []model.StatusComponentConfig{}}, nil
		}
		return err
	})
	return out, err
}

func (s *Services) SaveStatusPage(ctx context.Context, c *Caller, in model.StatusPageConfig) (*model.StatusPageConfig, error) {
	in.Name = strings.TrimSpace(in.Name)
	if in.Name == "" {
		return nil, invalid("name_required", "page name is required")
	}
	in.Slug = strings.ToLower(strings.TrimSpace(in.Slug))
	if !slugRe.MatchString(in.Slug) {
		return nil, invalid("invalid_slug", "slug must be lowercase letters, digits and hyphens")
	}
	for i := range in.Components {
		row := &in.Components[i]
		row.Name = strings.TrimSpace(row.Name)
		if row.Name == "" {
			return nil, invalid("component_name_required", "every component needs a name")
		}
		if strings.HasPrefix(row.ID, "draft_") || !uuidRe.MatchString(row.ID) {
			row.ID = ""
		}
	}
	var out *model.StatusPageConfig
	err := s.inOrg(ctx, c, "admin", func(tx pgx.Tx) error {
		for _, row := range in.Components {
			if row.MonitorID != nil {
				if _, err := repository.GetMonitor(ctx, tx, *row.MonitorID); err != nil {
					return invalid("monitor_not_found", "no uptime check "+*row.MonitorID)
				}
			}
		}
		var err error
		out, err = repository.SaveStatusPage(ctx, tx, c.OrgID, in)
		if errors.Is(err, repository.ErrConflict) {
			return invalid("slug_taken", "this slug belongs to another org")
		}
		return err
	})
	if err == nil {
		s.statusCache.forget(in.Slug)
	}
	return out, err
}

var uuidRe = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

// statusCache holds the 90-day bars per slug for 5 minutes and serves the
// last good copy when api/query is down (§6.7).
type statusCache struct {
	mu    sync.Mutex
	bars  map[string]cachedBars
	fresh time.Duration
}

type cachedBars struct {
	at   time.Time
	bars map[string]UptimeSummary
}

func newStatusCache() *statusCache {
	return &statusCache{bars: map[string]cachedBars{}, fresh: 5 * time.Minute}
}

func (c *statusCache) get(slug string) (cachedBars, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	b, ok := c.bars[slug]
	return b, ok
}

func (c *statusCache) put(slug string, bars map[string]UptimeSummary, now time.Time) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.bars[slug] = cachedBars{at: now, bars: bars}
}

func (c *statusCache) forget(slug string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.bars, slug)
}

// PublicStatusPage is GET /v1/status/{slug}: live states from Postgres,
// bars from api/query behind the cache.
func (s *Services) PublicStatusPage(ctx context.Context, slug string) (*model.StatusPage, error) {
	var orgID string
	var updatedAt time.Time
	if err := s.DB.AsSystem(ctx, func(tx pgx.Tx) (err error) {
		orgID, updatedAt, err = repository.SlugOwner(ctx, tx, strings.ToLower(slug))
		return err
	}); err != nil {
		return nil, orNotFound(err, "status page")
	}
	page := &model.StatusPage{Slug: slug, UpdatedAt: updatedAt, Components: []model.StatusComponent{}, Incidents: []model.StatusIncident{}}
	var cfg *model.StatusPageConfig
	monitors := map[string]model.Monitor{}
	err := s.DB.AsOrg(ctx, orgID, func(tx pgx.Tx) error {
		org, err := repository.OrgByID(ctx, tx, orgID)
		if err != nil {
			return err
		}
		page.OrgName = org.Name
		if cfg, err = repository.StatusPageConfig(ctx, tx); err != nil {
			return err
		}
		list, err := repository.ListMonitors(ctx, tx)
		if err != nil {
			return err
		}
		for _, m := range list {
			s.lazyNodata(&m)
			monitors[m.ID] = m
		}
		var monitorIDs, names []string
		for _, row := range cfg.Components {
			names = append(names, strings.ToLower(row.Name))
			if row.MonitorID != nil {
				monitorIDs = append(monitorIDs, *row.MonitorID)
			}
		}
		incidents, err := repository.RecentIncidents(ctx, tx, s.Now().Add(-90*24*time.Hour), monitorIDs, names)
		if err != nil {
			return err
		}
		for _, inc := range incidents {
			entries, err := repository.PublicTimeline(ctx, tx, inc.ID)
			if err != nil {
				return err
			}
			si := model.StatusIncident{Key: inc.Key, Title: inc.Title, Sev: inc.Sev, Status: inc.Status, StartedAt: inc.StartedAt,
				Updates: []model.StatusIncidentUpdate{}}
			for _, e := range entries {
				si.Updates = append(si.Updates, model.StatusIncidentUpdate{TS: e.TS, Phase: e.Phase, Body: e.Body})
			}
			page.Incidents = append(page.Incidents, si)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	bars := s.statusBars(ctx, slug, orgID, cfg)
	down, nodata, mapped := 0, 0, 0
	for _, row := range cfg.Components {
		comp := model.StatusComponent{Name: row.Name, Status: "pending", Days: []model.UptimeDay{}}
		if row.MonitorID != nil {
			if m, ok := monitors[*row.MonitorID]; ok {
				mapped++
				comp.Status = m.Status
				if m.Status == "down" {
					down++
				}
				if m.Status == "nodata" {
					nodata++
				}
			}
			if b, ok := bars[*row.MonitorID]; ok {
				comp.Days, comp.UptimePct, comp.P95Ms = b.Days, b.UptimePct, b.P95Ms
			}
		}
		page.Components = append(page.Components, comp)
	}
	open := false
	for _, inc := range page.Incidents {
		open = open || inc.Status != "resolved"
	}
	switch {
	case mapped > 0 && down == mapped:
		page.Overall = "major_outage"
	case down > 0:
		page.Overall = "partial_outage"
	case nodata > 0 || open:
		page.Overall = "degraded"
	default:
		page.Overall = "operational"
	}
	return page, nil
}

func (s *Services) statusBars(ctx context.Context, slug, orgID string, cfg *model.StatusPageConfig) map[string]UptimeSummary {
	now := s.Now()
	cached, ok := s.statusCache.get(slug)
	if ok && now.Sub(cached.at) < s.statusCache.fresh {
		return cached.bars
	}
	var ids []string
	for _, row := range cfg.Components {
		if row.MonitorID != nil {
			ids = append(ids, *row.MonitorID)
		}
	}
	if len(ids) == 0 || s.Telemetry == nil {
		return map[string]UptimeSummary{}
	}
	qctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	bars, err := s.Telemetry.Uptime(qctx, orgID, ids, 90)
	if err != nil {
		slog.WarnContext(ctx, "status bars unavailable; serving the last good copy", "error", err)
		return cached.bars
	}
	s.statusCache.put(slug, bars, now)
	return bars
}
