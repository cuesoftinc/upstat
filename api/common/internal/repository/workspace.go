package repository

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
)

// ── SLOs ────────────────────────────────────────────────────────────────

const sloColumns = `id, org_id, name, sli_source, target, window_spec, current, budget_remaining_pct, burn_rate, state,
	exhausted_at, monitor_id, query`

func scanSLO(r pgx.Row) (*model.SLO, error) {
	var s model.SLO
	return &s, r.Scan(&s.ID, &s.OrgID, &s.Name, &s.SLISource, &s.Target, &s.Window, &s.Current, &s.BudgetRemainingPct,
		&s.BurnRate, &s.State, &s.ExhaustedAt, &s.MonitorID, &s.Query)
}

func ListSLOs(ctx context.Context, tx pgx.Tx) ([]model.SLO, error) {
	rows, err := tx.Query(ctx, `SELECT `+sloColumns+` FROM slos ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanSLO)
}

func CreateSLO(ctx context.Context, tx pgx.Tx, orgID string, s model.SLO) (*model.SLO, error) {
	return one(tx.QueryRow(ctx, `INSERT INTO slos (org_id, name, sli_source, target, window_spec, monitor_id, query)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING `+sloColumns,
		orgID, s.Name, s.SLISource, s.Target, s.Window, s.MonitorID, s.Query), scanSLO)
}

func DeleteSLO(ctx context.Context, tx pgx.Tx, id string) error {
	return affected(tx.Exec(ctx, `DELETE FROM slos WHERE id = $1`, id))
}

type SLOStatus struct {
	ID, State                      string
	Current, BudgetRemaining, Burn float64
	ExhaustedAt                    *time.Time
}

func SetSLOStatus(ctx context.Context, tx pgx.Tx, s SLOStatus) error {
	_, err := tx.Exec(ctx, `UPDATE slos SET current = $2, budget_remaining_pct = $3, burn_rate = $4, state = $5, exhausted_at = $6
		WHERE id = $1`, s.ID, s.Current, s.BudgetRemaining, s.Burn, s.State, s.ExhaustedAt)
	return err
}

// ── Dashboards and widgets ──────────────────────────────────────────────

func scanWidget(r pgx.Row) (*model.Widget, error) {
	var w model.Widget
	var query, viz, layout []byte
	if err := r.Scan(&w.ID, &w.DashboardID, &w.Type, &w.Title, &query, &w.QueryString, &viz, &layout); err != nil {
		return nil, err
	}
	w.Query = json.RawMessage("null")
	if query != nil {
		w.Query = query
	}
	w.VizOptions = viz
	return &w, json.Unmarshal(layout, &w.Layout)
}

const widgetColumns = `id, dashboard_id, type, title, query, query_string, viz_options, layout`

func scanDashboard(r pgx.Row) (*model.Dashboard, error) {
	var d model.Dashboard
	var vars []byte
	if err := r.Scan(&d.ID, &d.OrgID, &d.Name, &d.Favorite, &d.Shared, &vars, &d.UpdatedAt); err != nil {
		return nil, err
	}
	d.TemplateVars = map[string][]string{}
	d.Widgets = []model.Widget{}
	return &d, json.Unmarshal(vars, &d.TemplateVars)
}

const dashboardColumns = `id, org_id, name, favorite, shared, template_vars, updated_at`

func withWidgets(ctx context.Context, tx pgx.Tx, dashboards []model.Dashboard) ([]model.Dashboard, error) {
	rows, err := tx.Query(ctx, `SELECT `+widgetColumns+` FROM widgets ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	widgets, err := collect(rows, scanWidget)
	if err != nil {
		return nil, err
	}
	index := map[string]int{}
	for i := range dashboards {
		index[dashboards[i].ID] = i
	}
	for _, w := range widgets {
		if i, ok := index[w.DashboardID]; ok {
			dashboards[i].Widgets = append(dashboards[i].Widgets, w)
		}
	}
	return dashboards, nil
}

func ListDashboards(ctx context.Context, tx pgx.Tx) ([]model.Dashboard, error) {
	rows, err := tx.Query(ctx, `SELECT `+dashboardColumns+` FROM dashboards ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	dashboards, err := collect(rows, scanDashboard)
	if err != nil {
		return nil, err
	}
	return withWidgets(ctx, tx, dashboards)
}

func GetDashboard(ctx context.Context, tx pgx.Tx, id string) (*model.Dashboard, error) {
	d, err := one(tx.QueryRow(ctx, `SELECT `+dashboardColumns+` FROM dashboards WHERE id = $1`, id), scanDashboard)
	if err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `SELECT `+widgetColumns+` FROM widgets WHERE dashboard_id = $1 ORDER BY created_at`, id)
	if err != nil {
		return nil, err
	}
	if d.Widgets, err = collect(rows, scanWidget); err != nil {
		return nil, err
	}
	return d, nil
}

func CreateDashboard(ctx context.Context, tx pgx.Tx, orgID, name string) (*model.Dashboard, error) {
	return one(tx.QueryRow(ctx, `INSERT INTO dashboards (org_id, name) VALUES ($1, $2) RETURNING `+dashboardColumns, orgID, name), scanDashboard)
}

type DashboardPatch struct {
	Name             *string
	Favorite, Shared *bool
	TemplateVars     *map[string][]string
}

func UpdateDashboard(ctx context.Context, tx pgx.Tx, id string, p DashboardPatch) error {
	var vars any
	if p.TemplateVars != nil {
		vars = mustJSON(*p.TemplateVars)
	}
	return affected(tx.Exec(ctx, `UPDATE dashboards SET name = coalesce($2, name), favorite = coalesce($3, favorite),
			shared = coalesce($4, shared), template_vars = coalesce($5, template_vars), updated_at = now()
		WHERE id = $1`, id, p.Name, p.Favorite, p.Shared, vars))
}

func TouchDashboard(ctx context.Context, tx pgx.Tx, id string) error {
	return affected(tx.Exec(ctx, `UPDATE dashboards SET updated_at = now() WHERE id = $1`, id))
}

func DeleteDashboard(ctx context.Context, tx pgx.Tx, id string) error {
	return affected(tx.Exec(ctx, `DELETE FROM dashboards WHERE id = $1`, id))
}

func CreateWidget(ctx context.Context, tx pgx.Tx, orgID string, w model.Widget) (*model.Widget, error) {
	return one(tx.QueryRow(ctx, `INSERT INTO widgets (org_id, dashboard_id, type, title, query, query_string, viz_options, layout)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING `+widgetColumns,
		orgID, w.DashboardID, w.Type, w.Title, nullJSON(w.Query), w.QueryString, []byte(w.VizOptions), mustJSON(w.Layout)), scanWidget)
}

func GetWidget(ctx context.Context, tx pgx.Tx, dashboardID, id string) (*model.Widget, error) {
	return one(tx.QueryRow(ctx, `SELECT `+widgetColumns+` FROM widgets WHERE dashboard_id = $1 AND id = $2`, dashboardID, id), scanWidget)
}

func SaveWidget(ctx context.Context, tx pgx.Tx, w model.Widget) (*model.Widget, error) {
	return one(tx.QueryRow(ctx, `UPDATE widgets SET type = $3, title = $4, query = $5, query_string = $6, viz_options = $7, layout = $8
		WHERE dashboard_id = $1 AND id = $2 RETURNING `+widgetColumns,
		w.DashboardID, w.ID, w.Type, w.Title, nullJSON(w.Query), w.QueryString, []byte(w.VizOptions), mustJSON(w.Layout)), scanWidget)
}

func DeleteWidget(ctx context.Context, tx pgx.Tx, dashboardID, id string) error {
	return affected(tx.Exec(ctx, `DELETE FROM widgets WHERE dashboard_id = $1 AND id = $2`, dashboardID, id))
}

// ── Saved views (MI-18) ─────────────────────────────────────────────────

// ListViews returns the caller's personal views plus every org view, with
// the sharer's name on org views.
func ListViews(ctx context.Context, tx pgx.Tx, userID, surface string) ([]model.SavedView, error) {
	rows, err := tx.Query(ctx, `SELECT v.id, v.name, v.scope, v.surface, v.query, v.created_at, u.name
		FROM saved_views v JOIN users u ON u.id = v.user_id
		WHERE (v.user_id = $1 OR v.scope = 'org') AND ($2 = '' OR v.surface = $2) ORDER BY v.created_at`, userID, surface)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanView)
}

func scanView(r pgx.Row) (*model.SavedView, error) {
	var v model.SavedView
	var sharer string
	if err := r.Scan(&v.ID, &v.Name, &v.Scope, &v.Surface, &v.Query, &v.CreatedAt, &sharer); err != nil {
		return nil, err
	}
	if v.Scope == "org" {
		v.SharedWith = []string{sharer}
	}
	return &v, nil
}

func CreateView(ctx context.Context, tx pgx.Tx, orgID, userID string, v model.SavedView) (*model.SavedView, error) {
	return one(tx.QueryRow(ctx, `WITH v AS (INSERT INTO saved_views (org_id, user_id, name, scope, surface, query)
			VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, scope, surface, query, created_at, user_id)
		SELECT v.id, v.name, v.scope, v.surface, v.query, v.created_at, u.name FROM v JOIN users u ON u.id = v.user_id`,
		orgID, userID, v.Name, v.Scope, v.Surface, v.Query), scanView)
}

// DeleteView deletes the caller's own view (org views too: the sharer).
func DeleteView(ctx context.Context, tx pgx.Tx, userID, id string) error {
	return affected(tx.Exec(ctx, `DELETE FROM saved_views WHERE id = $1 AND user_id = $2`, id, userID))
}

// ── Service catalog ─────────────────────────────────────────────────────

func scanCatalog(r pgx.Row) (*model.CatalogEntry, error) {
	var c model.CatalogEntry
	var links []byte
	if err := r.Scan(&c.ID, &c.Name, &c.Owner, &links, &c.Environments); err != nil {
		return nil, err
	}
	return &c, json.Unmarshal(links, &c.Links)
}

func ListCatalog(ctx context.Context, tx pgx.Tx) ([]model.CatalogEntry, error) {
	rows, err := tx.Query(ctx, `SELECT id, name, owner, links, environments FROM catalog ORDER BY name`)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanCatalog)
}

func CreateCatalog(ctx context.Context, tx pgx.Tx, orgID string, c model.CatalogEntry) (*model.CatalogEntry, error) {
	return one(tx.QueryRow(ctx, `INSERT INTO catalog (org_id, name, owner, links, environments) VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, owner, links, environments`, orgID, c.Name, c.Owner, mustJSON(c.Links), c.Environments), scanCatalog)
}

func UpdateCatalog(ctx context.Context, tx pgx.Tx, c model.CatalogEntry) (*model.CatalogEntry, error) {
	return one(tx.QueryRow(ctx, `UPDATE catalog SET name = $2, owner = $3, links = $4, environments = $5 WHERE id = $1
		RETURNING id, name, owner, links, environments`, c.ID, c.Name, c.Owner, mustJSON(c.Links), c.Environments), scanCatalog)
}

func GetCatalog(ctx context.Context, tx pgx.Tx, id string) (*model.CatalogEntry, error) {
	return one(tx.QueryRow(ctx, `SELECT id, name, owner, links, environments FROM catalog WHERE id = $1`, id), scanCatalog)
}

func DeleteCatalog(ctx context.Context, tx pgx.Tx, id string) error {
	return affected(tx.Exec(ctx, `DELETE FROM catalog WHERE id = $1`, id))
}

// ── Status page ─────────────────────────────────────────────────────────

// StatusPageConfig is the org's builder document, or ErrNotFound.
func StatusPageConfig(ctx context.Context, tx pgx.Tx) (*model.StatusPageConfig, error) {
	var cfg model.StatusPageConfig
	if err := tx.QueryRow(ctx, `SELECT name, slug FROM status_pages`).Scan(&cfg.Name, &cfg.Slug); err != nil {
		return nil, translate(err)
	}
	rows, err := tx.Query(ctx, `SELECT id, name, monitor_id FROM status_components ORDER BY position`)
	if err != nil {
		return nil, err
	}
	cfg.Components, err = collect(rows, func(r pgx.Row) (*model.StatusComponentConfig, error) {
		var c model.StatusComponentConfig
		return &c, r.Scan(&c.ID, &c.Name, &c.MonitorID)
	})
	return &cfg, err
}

// SaveStatusPage replaces the builder document; the slug is unique across
// orgs (ErrConflict).
func SaveStatusPage(ctx context.Context, tx pgx.Tx, orgID string, cfg model.StatusPageConfig) (*model.StatusPageConfig, error) {
	if _, err := tx.Exec(ctx, `INSERT INTO status_pages (org_id, name, slug) VALUES ($1, $2, $3)
		ON CONFLICT (org_id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, updated_at = now()`,
		orgID, cfg.Name, cfg.Slug); err != nil {
		return nil, translate(err)
	}
	if _, err := tx.Exec(ctx, `DELETE FROM status_components`); err != nil {
		return nil, err
	}
	for i, c := range cfg.Components {
		if _, err := tx.Exec(ctx, `INSERT INTO status_components (id, org_id, position, name, monitor_id)
			VALUES (coalesce(nullif($1, '')::uuid, gen_random_uuid()), $2, $3, $4, $5)`, c.ID, orgID, i, c.Name, c.MonitorID); err != nil {
			return nil, translate(err)
		}
	}
	return StatusPageConfig(ctx, tx)
}

// SlugOwner is the org that owns a status page slug (system read).
func SlugOwner(ctx context.Context, tx pgx.Tx, slug string) (orgID string, updatedAt time.Time, err error) {
	err = tx.QueryRow(ctx, `SELECT org_id, updated_at FROM status_pages WHERE slug = $1`, slug).Scan(&orgID, &updatedAt)
	return orgID, updatedAt, translate(err)
}

// ── Synthetics (multi-step and browser checks, pages.md B7) ────────────

const syntheticColumns = `id, org_id, name, kind, steps, browser, interval_s, last_run_id, last_run_status, last_run_at,
	created_at, updated_at`

func scanSynthetic(r pgx.Row) (*model.SyntheticCheck, error) { return scanSyntheticWith(r) }

// scanSyntheticWith scans syntheticColumns and then extra.
func scanSyntheticWith(r pgx.Row, extra ...any) (*model.SyntheticCheck, error) {
	var c model.SyntheticCheck
	var steps, browser []byte
	dest := append([]any{&c.ID, &c.OrgID, &c.Name, &c.Kind, &steps, &browser, &c.IntervalSeconds, &c.LastRunID, &c.LastRunStatus,
		&c.LastRunAt, &c.CreatedAt, &c.UpdatedAt}, extra...)
	if err := r.Scan(dest...); err != nil {
		return nil, err
	}
	if err := json.Unmarshal(steps, &c.Steps); err != nil {
		return nil, err
	}
	if browser != nil {
		c.Browser = &model.BrowserConfig{}
		if err := json.Unmarshal(browser, c.Browser); err != nil {
			return nil, err
		}
	}
	return &c, nil
}

func ListSynthetics(ctx context.Context, tx pgx.Tx) ([]model.SyntheticCheck, error) {
	rows, err := tx.Query(ctx, `SELECT `+syntheticColumns+` FROM synthetics ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanSynthetic)
}

func GetSynthetic(ctx context.Context, tx pgx.Tx, id string) (*model.SyntheticCheck, error) {
	return one(tx.QueryRow(ctx, `SELECT `+syntheticColumns+` FROM synthetics WHERE id = $1`, id), scanSynthetic)
}

func browserJSON(b *model.BrowserConfig) any {
	if b == nil {
		return nil
	}
	return mustJSON(b)
}

func CreateSynthetic(ctx context.Context, tx pgx.Tx, orgID string, c model.SyntheticCheck) (*model.SyntheticCheck, error) {
	return one(tx.QueryRow(ctx, `INSERT INTO synthetics (org_id, name, kind, steps, browser, interval_s, next_run_at)
		VALUES ($1, $2, $3, $4, $5, $6, now() + make_interval(secs => abs(hashtext(gen_random_uuid()::text)) % $6))
		RETURNING `+syntheticColumns, orgID, c.Name, c.Kind, mustJSON(c.Steps), browserJSON(c.Browser), c.IntervalSeconds), scanSynthetic)
}

func SaveSynthetic(ctx context.Context, tx pgx.Tx, c model.SyntheticCheck) (*model.SyntheticCheck, error) {
	return one(tx.QueryRow(ctx, `UPDATE synthetics SET name = $2, kind = $3, steps = $4, browser = $5, interval_s = $6, updated_at = now()
		WHERE id = $1 RETURNING `+syntheticColumns, c.ID, c.Name, c.Kind, mustJSON(c.Steps), browserJSON(c.Browser), c.IntervalSeconds),
		scanSynthetic)
}

func DeleteSynthetic(ctx context.Context, tx pgx.Tx, id string) error {
	return affected(tx.Exec(ctx, `DELETE FROM synthetics WHERE id = $1`, id))
}

// DueSynthetic is a claimed check and the next_run_at it was claimed at.
type DueSynthetic struct {
	Check   model.SyntheticCheck
	Claimed time.Time
}

// ClaimDueSynthetics leases due checks for lease (as monitors): the check is
// advanced only by CompleteSynthetics, so a failed pass is retried.
func ClaimDueSynthetics(ctx context.Context, tx pgx.Tx, limit int, lease time.Duration) ([]DueSynthetic, error) {
	rows, err := tx.Query(ctx, `WITH due AS (
			SELECT id FROM synthetics WHERE next_run_at <= now() AND (leased_until IS NULL OR leased_until <= now())
			ORDER BY next_run_at LIMIT $1 FOR UPDATE SKIP LOCKED)
		UPDATE synthetics s SET leased_until = now() + make_interval(secs => $2)
		FROM due WHERE s.id = due.id RETURNING `+prefixed("s.", syntheticColumns)+`, s.next_run_at`, limit, lease.Seconds())
	if err != nil {
		return nil, err
	}
	return collect(rows, func(r pgx.Row) (*DueSynthetic, error) {
		var d DueSynthetic
		check, err := scanSyntheticWith(r, &d.Claimed)
		if err != nil {
			return nil, err
		}
		d.Check = *check
		return &d, nil
	})
}

// CompleteSynthetics moves each claimed check to its next slot and ends its
// lease; a check edited since the claim keeps the next_run_at the edit set.
func CompleteSynthetics(ctx context.Context, tx pgx.Tx, done []DueSynthetic) error {
	if len(done) == 0 {
		return nil
	}
	ids, claimed := make([]string, len(done)), make([]time.Time, len(done))
	for i, d := range done {
		ids[i], claimed[i] = d.Check.ID, d.Claimed
	}
	_, err := tx.Exec(ctx, `UPDATE synthetics s SET leased_until = NULL,
			next_run_at = CASE WHEN s.next_run_at = c.claimed THEN s.next_run_at + make_interval(secs =>
				s.interval_s * (floor(extract(epoch FROM now() - s.next_run_at) / s.interval_s) + 1)) ELSE s.next_run_at END
		FROM unnest($1::text[]::uuid[], $2::timestamptz[]) AS c(id, claimed) WHERE s.id = c.id`, ids, claimed)
	return err
}

func prefixed(p, columns string) string {
	parts := strings.Split(columns, ",")
	for i, c := range parts {
		parts[i] = p + strings.TrimSpace(c)
	}
	return strings.Join(parts, ", ")
}

// InsertRun stores a run with the check's next run number and points the
// check at it.
func InsertRun(ctx context.Context, tx pgx.Tx, orgID string, run model.SyntheticRun) (*model.SyntheticRun, error) {
	var shot any
	if run.FailureScreenshot != nil {
		shot = mustJSON(run.FailureScreenshot)
	}
	err := tx.QueryRow(ctx, `WITH n AS (UPDATE synthetics SET runs = runs + 1 WHERE id = $2 RETURNING runs)
		INSERT INTO synthetic_runs (org_id, check_id, number, status, started_at, total_ms, steps, steps_total, failure_screenshot)
		SELECT $1, $2, n.runs, $3, $4, $5, $6, $7, $8 FROM n RETURNING id, number`,
		orgID, run.CheckID, run.Status, run.StartedAt, run.TotalMs, mustJSON(run.Steps), run.StepsTotal, shot).Scan(&run.ID, &run.Number)
	if err != nil {
		return nil, translate(err)
	}
	_, err = tx.Exec(ctx, `UPDATE synthetics SET last_run_id = $2, last_run_status = $3, last_run_at = $4 WHERE id = $1`,
		run.CheckID, run.ID, run.Status, run.StartedAt)
	return &run, err
}

func scanRun(r pgx.Row) (*model.SyntheticRun, error) {
	var run model.SyntheticRun
	var steps, shot []byte
	if err := r.Scan(&run.ID, &run.CheckID, &run.Number, &run.Status, &run.StartedAt, &run.TotalMs, &steps, &run.StepsTotal, &shot); err != nil {
		return nil, err
	}
	if shot != nil {
		run.FailureScreenshot = &model.FailureScreenshot{}
		_ = json.Unmarshal(shot, run.FailureScreenshot)
	}
	return &run, json.Unmarshal(steps, &run.Steps)
}

const runColumns = `id, check_id, number, status, started_at, total_ms, steps, steps_total, failure_screenshot`

func ListRuns(ctx context.Context, tx pgx.Tx, checkID string, limit int) ([]model.SyntheticRun, error) {
	rows, err := tx.Query(ctx, `SELECT `+runColumns+` FROM synthetic_runs WHERE check_id = $1 ORDER BY number DESC LIMIT $2`, checkID, limit)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanRun)
}

func GetRun(ctx context.Context, tx pgx.Tx, checkID, id string) (*model.SyntheticRun, error) {
	return one(tx.QueryRow(ctx, `SELECT `+runColumns+` FROM synthetic_runs WHERE check_id = $1 AND id = $2`, checkID, id), scanRun)
}

func PruneRuns(ctx context.Context, tx pgx.Tx, olderThan time.Duration) (int64, error) {
	tag, err := tx.Exec(ctx, `DELETE FROM synthetic_runs WHERE started_at < now() - make_interval(secs => $1)`, olderThan.Seconds())
	return tag.RowsAffected(), err
}
