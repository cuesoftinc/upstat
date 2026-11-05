package telemetry

import (
	"context"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/cuesoftinc/upstat/api/query/internal/chdb"
)

// RUM and product events (pages.md B6, analytics-math.md). Uniques are
// exact within a day and never summed across days (§4); a visit is a run of
// one visitor's events with gaps under 30 minutes (§2).

type ValueCount struct {
	Value string `json:"value"`
	Count int64  `json:"count"`
}

type RumBucket struct {
	Bucket  time.Time `json:"bucket"`
	Count   int64     `json:"count"`
	Uniques int64     `json:"uniques"`
}

type RumSummary struct {
	PageViews       int64        `json:"page_views"`
	Visits          int64        `json:"visits"`
	BounceRate      *float64     `json:"bounce_rate"`
	AvgVisitSeconds *float64     `json:"avg_visit_seconds"`
	UniquesDailyAvg float64      `json:"uniques_daily_avg"`
	UniquesAdditive bool         `json:"uniques_additive"`
	Series          []RumBucket  `json:"series"`
	TopPages        []ValueCount `json:"top_pages"`
	TopReferrers    []ValueCount `json:"top_referrers"`
	Devices         []ValueCount `json:"devices"`
	Countries       []ValueCount `json:"countries"`
}

// eventScope is the shared WHERE for an org's events, optionally one property.
func eventScope(orgID, property string, from, to time.Time) (string, map[string]string) {
	params := map[string]string{"o": orgID, "f": ts(from), "t": ts(to)}
	w := "org_id = {o:String} AND ts >= {f:DateTime64(3)} AND ts < {t:DateTime64(3)}"
	if property != "" {
		w += " AND property_id = {prop:String}"
		params["prop"] = property
	}
	return w, params
}

// visitsSQL sessionizes: a new visit starts after a 30-minute gap; only
// browser events (with a visitor hash) count (analytics-math.md §4a).
func visitsSQL(where string) string {
	return fmt.Sprintf(`SELECT count() AS visits, countIf(pv = 1) AS bounces, sumIf(dur, pv > 1) AS engaged_seconds, countIf(pv > 1) AS engaged
		FROM (SELECT countIf(name = 'page_view') AS pv, dateDiff('second', min(ts), max(ts)) AS dur
			FROM (SELECT visitor_hash, property_id, name, ts,
					sum(gap) OVER (PARTITION BY property_id, visitor_hash ORDER BY ts ROWS UNBOUNDED PRECEDING) AS session
				FROM (SELECT visitor_hash, property_id, name, ts,
						if(dateDiff('second', lagInFrame(ts, 1, toDateTime64(0, 3)) OVER (PARTITION BY property_id, visitor_hash ORDER BY ts
							ROWS BETWEEN 1 PRECEDING AND CURRENT ROW), ts) >= 1800, 1, 0) AS gap
					FROM events WHERE %s AND visitor_hash != ''))
			GROUP BY visitor_hash, property_id, session)`, where)
}

func f(r map[string]any, k string) float64 {
	v, _ := chdb.Float(r[k])
	return v
}

func (s *Service) top(ctx context.Context, orgID, where string, params map[string]string, expr string) ([]ValueCount, error) {
	rows, err := s.CH.Rows(ctx, orgID, fmt.Sprintf(`SELECT %s AS v, count() AS c FROM events WHERE %s AND name = 'page_view' AND v != ''
		GROUP BY v ORDER BY c DESC LIMIT 10`, expr, where), params)
	if err != nil {
		return nil, err
	}
	out := []ValueCount{}
	for _, r := range rows {
		out = append(out, ValueCount{Value: chdb.Str(r["v"]), Count: int64(f(r, "c"))})
	}
	return out, nil
}

func (s *Service) RumSummary(ctx context.Context, orgID, property, fromRaw, toRaw string) (*RumSummary, error) {
	from, to, err := Range(fromRaw, toRaw, s.Now().UTC(), 7*24*time.Hour)
	if err != nil {
		return nil, err
	}
	where, params := eventScope(orgID, property, from, to)
	out := &RumSummary{Series: []RumBucket{}}
	pv, err := s.CH.Rows(ctx, orgID, "SELECT countIf(name = 'page_view') AS pv FROM events WHERE "+where, params)
	if err != nil {
		return nil, err
	}
	out.PageViews = int64(f(pv[0], "pv"))
	v, err := s.CH.Rows(ctx, orgID, visitsSQL(where), params)
	if err != nil {
		return nil, err
	}
	out.Visits = int64(f(v[0], "visits"))
	if out.Visits > 0 {
		br := f(v[0], "bounces") / float64(out.Visits)
		out.BounceRate = &br
	}
	if engaged := f(v[0], "engaged"); engaged > 0 {
		avg := math.Round(f(v[0], "engaged_seconds")/engaged*10) / 10
		out.AvgVisitSeconds = &avg
	}
	u, err := s.CH.Rows(ctx, orgID, `SELECT avg(u) AS u FROM (SELECT toDate(ts) AS d, uniqExact(visitor_hash) AS u FROM events
		WHERE `+where+` AND visitor_hash != '' GROUP BY d)`, params)
	if err != nil {
		return nil, err
	}
	out.UniquesDailyAvg = math.Round(f(u[0], "u")*10) / 10
	bucket := "toStartOfHour(ts)"
	if to.Sub(from) > 48*time.Hour {
		bucket = "toStartOfDay(ts)"
	}
	series, err := s.CH.Rows(ctx, orgID, fmt.Sprintf(`SELECT %s AS b, countIf(name = 'page_view') AS c, uniqExactIf(visitor_hash, visitor_hash != '') AS u
		FROM events WHERE %s GROUP BY b ORDER BY b`, bucket, where), params)
	if err != nil {
		return nil, err
	}
	for _, r := range series {
		out.Series = append(out.Series, RumBucket{Bucket: chdb.Time(r["b"]), Count: int64(f(r, "c")), Uniques: int64(f(r, "u"))})
	}
	for _, t := range []struct {
		dst  *[]ValueCount
		expr string
	}{{&out.TopPages, "path"}, {&out.TopReferrers, "referrer_host"}, {&out.Devices, "device_class"}, {&out.Countries, "country"}} {
		if *t.dst, err = s.top(ctx, orgID, where, params, t.expr); err != nil {
			return nil, err
		}
	}
	return out, nil
}

type Quantiles struct {
	P50 float64 `json:"p50"`
	P75 float64 `json:"p75"`
	P95 float64 `json:"p95"`
}

type VitalsBucket struct {
	Bucket time.Time `json:"bucket"`
	LCPMs  float64   `json:"lcp_ms"`
	CLS    float64   `json:"cls"`
	INPMs  float64   `json:"inp_ms"`
}

type RumVitals struct {
	LCPMs  Quantiles      `json:"lcp_ms"`
	CLS    Quantiles      `json:"cls"`
	INPMs  Quantiles      `json:"inp_ms"`
	Series []VitalsBucket `json:"series"`
}

// Vitals reads web_vital events (dims metric = lcp | cls | inp, value).
func (s *Service) Vitals(ctx context.Context, orgID, property, fromRaw, toRaw string) (*RumVitals, error) {
	from, to, err := Range(fromRaw, toRaw, s.Now().UTC(), 7*24*time.Hour)
	if err != nil {
		return nil, err
	}
	where, params := eventScope(orgID, property, from, to)
	where += " AND name = 'web_vital'"
	rows, err := s.CH.Rows(ctx, orgID, `SELECT dims['dim.metric'] AS m, quantiles(0.5, 0.75, 0.95)(value) AS q FROM events
		WHERE `+where+` GROUP BY m`, params)
	if err != nil {
		return nil, err
	}
	out := &RumVitals{Series: []VitalsBucket{}}
	for _, r := range rows {
		q, _ := r["q"].([]any)
		if len(q) != 3 {
			continue
		}
		vals := Quantiles{}
		vals.P50, _ = chdb.Float(q[0])
		vals.P75, _ = chdb.Float(q[1])
		vals.P95, _ = chdb.Float(q[2])
		switch chdb.Str(r["m"]) {
		case "lcp":
			out.LCPMs = vals
		case "cls":
			out.CLS = vals
		case "inp":
			out.INPMs = vals
		}
	}
	bucket := "toStartOfHour(ts)"
	if to.Sub(from) > 48*time.Hour {
		bucket = "toStartOfDay(ts)"
	}
	series, err := s.CH.Rows(ctx, orgID, fmt.Sprintf(`SELECT %s AS b,
			quantileIf(0.75)(value, dims['dim.metric'] = 'lcp') AS lcp, quantileIf(0.75)(value, dims['dim.metric'] = 'cls') AS cls,
			quantileIf(0.75)(value, dims['dim.metric'] = 'inp') AS inp
		FROM events WHERE %s GROUP BY b ORDER BY b`, bucket, where), params)
	if err != nil {
		return nil, err
	}
	for _, r := range series {
		out.Series = append(out.Series, VitalsBucket{Bucket: chdb.Time(r["b"]), LCPMs: nan0(f(r, "lcp")), CLS: nan0(f(r, "cls")), INPMs: nan0(f(r, "inp"))})
	}
	return out, nil
}

func nan0(v float64) float64 {
	if math.IsNaN(v) {
		return 0
	}
	return v
}

type ErrorGroup struct {
	Fingerprint string    `json:"fingerprint"`
	Message     string    `json:"message"`
	Count       int64     `json:"count"`
	FirstSeen   time.Time `json:"first_seen"`
	LastSeen    time.Time `json:"last_seen"`
	State       string    `json:"state"`
	Sparkline   []int64   `json:"sparkline"`
}

// Errors groups js_error events by fingerprint over 30 days: new within a
// day of first sight, regressed when it came back after 7 quiet days.
func (s *Service) Errors(ctx context.Context, orgID string) ([]ErrorGroup, error) {
	now := s.Now().UTC()
	var spark []string
	for i := 6; i >= 0; i-- {
		spark = append(spark, fmt.Sprintf("countIf(toDate(ts) = toDate({n:DateTime64(3)}) - %d)", i))
	}
	rows, err := s.CH.Rows(ctx, orgID, fmt.Sprintf(`SELECT dims['dim.fingerprint'] AS fp, any(dims['dim.message']) AS msg, count() AS c,
			min(ts) AS first, max(ts) AS last, [%s] AS spark,
			arrayMax(arrayDifference(arraySort(groupUniqArray(toUInt32(toDate(ts)))))) AS max_gap_days
		FROM events WHERE org_id = {o:String} AND name = 'js_error' AND ts >= {f:DateTime64(3)} AND fp != ''
		GROUP BY fp ORDER BY last DESC LIMIT 200`, strings.Join(spark, ", ")),
		map[string]string{"o": orgID, "f": ts(now.Add(-30 * 24 * time.Hour)), "n": ts(now)})
	if err != nil {
		return nil, err
	}
	out := []ErrorGroup{}
	for _, r := range rows {
		g := ErrorGroup{Fingerprint: chdb.Str(r["fp"]), Message: chdb.Str(r["msg"]), Count: int64(f(r, "c")),
			FirstSeen: chdb.Time(r["first"]), LastSeen: chdb.Time(r["last"]), State: "ongoing", Sparkline: []int64{}}
		switch {
		case now.Sub(g.FirstSeen) < 24*time.Hour:
			g.State = "new"
		case f(r, "max_gap_days") > 7:
			g.State = "regressed"
		}
		if arr, ok := r["spark"].([]any); ok {
			for _, v := range arr {
				n, _ := chdb.Float(v)
				g.Sparkline = append(g.Sparkline, int64(n))
			}
		}
		out = append(out, g)
	}
	return out, nil
}

type FunnelStage struct {
	Key           string  `json:"key"`
	Label         string  `json:"label"`
	Count         int64   `json:"count"`
	PctOfPrevious float64 `json:"pct_of_previous"`
}

type Drilldown struct {
	Funnel struct {
		Stages          []FunnelStage `json:"stages"`
		ConversionEvent string        `json:"conversion_event"`
	} `json:"funnel"`
	Retention struct {
		Weeks   int   `json:"weeks"`
		Cohorts []any `json:"cohorts"`
	} `json:"retention"`
}

// Drilldown is the U6-2 funnel. Weekly retention needs a visitor linked
// across days, which the daily salt makes impossible by design
// (analytics-math.md §1), so it is reported empty rather than invented.
func (s *Service) Drilldown(ctx context.Context, orgID, property, conversion, fromRaw, toRaw string) (*Drilldown, error) {
	from, to, err := Range(fromRaw, toRaw, s.Now().UTC(), 30*24*time.Hour)
	if err != nil {
		return nil, err
	}
	if conversion == "" {
		conversion = "signup"
	}
	where, params := eventScope(orgID, property, from, to)
	params["conv"] = conversion
	pv, err := s.CH.Rows(ctx, orgID, "SELECT countIf(name = 'page_view') AS pv, countIf(name = {conv:String}) AS conv FROM events WHERE "+where, params)
	if err != nil {
		return nil, err
	}
	v, err := s.CH.Rows(ctx, orgID, visitsSQL(where), params)
	if err != nil {
		return nil, err
	}
	out := &Drilldown{}
	out.Funnel.ConversionEvent = conversion
	counts := []struct {
		key, label string
		n          int64
	}{{"page_views", "Page views", int64(f(pv[0], "pv"))}, {"sessions", "Sessions", int64(f(v[0], "visits"))},
		{"conversions", "Conversions", int64(f(pv[0], "conv"))}}
	for i, c := range counts {
		pct := 100.0
		if i > 0 {
			pct = 0
			if prev := counts[i-1].n; prev > 0 {
				pct = math.Round(float64(c.n)/float64(prev)*1000) / 10
			}
		}
		out.Funnel.Stages = append(out.Funnel.Stages, FunnelStage{Key: c.key, Label: c.label, Count: c.n, PctOfPrevious: pct})
	}
	out.Retention.Cohorts = []any{}
	return out, nil
}

// ── /v1/stats (api.md §3.3) ─────────────────────────────────────────────

type StatsPoint struct {
	Bucket  time.Time `json:"bucket"`
	Count   int64     `json:"count"`
	Uniques *int64    `json:"uniques"`
}

type Stats struct {
	Series []StatsPoint `json:"series"`
	Totals struct {
		Count           int64    `json:"count"`
		UniquesDailyAvg *float64 `json:"uniques_daily_avg"`
	} `json:"totals"`
	UniquesAdditive bool         `json:"uniques_additive"`
	ByDim           []ValueCount `json:"by_dim,omitempty"`
}

var browserDims = map[string]string{"path": "path", "referrer_host": "referrer_host", "device_class": "device_class", "country": "country"}

func (s *Service) Stats(ctx context.Context, orgID, property, name, period, fromRaw, toRaw, dim string) (*Stats, error) {
	if property == "" || name == "" {
		return nil, bad("bad_shape", "property and name are required")
	}
	if period != "hour" && period != "day" {
		return nil, bad("invalid_period", "period is hour or day")
	}
	from, to, err := Range(fromRaw, toRaw, s.Now().UTC(), 7*24*time.Hour)
	if err != nil {
		return nil, err
	}
	if period == "hour" && to.Sub(from) > 8*24*time.Hour {
		return nil, bad("range_too_large", "period=hour is limited to 8 days")
	}
	table, bucket := "events_daily", "toDateTime(bucket)"
	if period == "hour" {
		table, bucket = "events_hourly", "bucket"
	}
	params := map[string]string{"o": orgID, "p": property, "n": name, "f": ts(from), "t": ts(to)}
	rows, err := s.CH.Rows(ctx, orgID, fmt.Sprintf(`SELECT %s AS b, sum(events) AS c, uniqExactMerge(uniques) AS u FROM %s
		WHERE org_id = {o:String} AND property_id = {p:String} AND name = {n:String} AND %s >= {f:DateTime64(3)} AND %s < {t:DateTime64(3)}
		GROUP BY b ORDER BY b`, bucket, table, bucket, bucket), params)
	if err != nil {
		return nil, err
	}
	out := &Stats{Series: []StatsPoint{}}
	eligible := false
	for _, r := range rows {
		p := StatsPoint{Bucket: chdb.Time(r["b"]), Count: int64(f(r, "c"))}
		if u := int64(f(r, "u")); u > 0 {
			eligible = true
			p.Uniques = &u
		}
		out.Totals.Count += p.Count
		out.Series = append(out.Series, p)
	}
	// Server-emitted events carry no visitor hash: uniques are null, not 0
	// (analytics-math.md §4a).
	if eligible {
		for i := range out.Series {
			if out.Series[i].Uniques == nil {
				zero := int64(0)
				out.Series[i].Uniques = &zero
			}
		}
		daily, err := s.CH.Rows(ctx, orgID, `SELECT avg(u) AS u FROM (SELECT bucket, uniqExactMerge(uniques) AS u FROM events_daily
			WHERE org_id = {o:String} AND property_id = {p:String} AND name = {n:String} AND bucket >= toDate({f:DateTime64(3)})
				AND bucket < toDate({t:DateTime64(3)}) + 1 GROUP BY bucket)`, params)
		if err != nil {
			return nil, err
		}
		avg := math.Round(f(daily[0], "u")*10) / 10
		out.Totals.UniquesDailyAvg = &avg
	}
	if dim != "" {
		expr, ok := browserDims[dim]
		if !ok {
			expr = "dims[{d:String}]"
			params["d"] = "dim." + dim
		}
		byDim, err := s.CH.Rows(ctx, orgID, fmt.Sprintf(`SELECT %s AS v, count() AS c FROM events WHERE org_id = {o:String} AND property_id = {p:String}
			AND name = {n:String} AND ts >= {f:DateTime64(3)} AND ts < {t:DateTime64(3)} GROUP BY v ORDER BY c DESC LIMIT 50`, expr), params)
		if err != nil {
			return nil, err
		}
		out.ByDim = []ValueCount{}
		for _, r := range byDim {
			out.ByDim = append(out.ByDim, ValueCount{Value: chdb.Str(r["v"]), Count: int64(f(r, "c"))})
		}
	}
	return out, nil
}

// ── Usage (B12) ─────────────────────────────────────────────────────────

type UsageMeter struct {
	Pillar  string  `json:"pillar"`
	Label   string  `json:"label"`
	Value   float64 `json:"value"`
	Display string  `json:"display"`
	Peak    float64 `json:"peak"`
	Plan    string  `json:"plan"`
}

type UsageReport struct {
	MonthLabel string       `json:"month_label"`
	Rows       []UsageMeter `json:"rows"`
}

var pillars = []struct{ key, label, unit string }{
	// The gateway never parses OTLP (§6.3), so the OTLP pillars meter
	// accepted bytes; RUM counts the events it validated.
	{"metrics", "Metrics — ingested", "bytes"},
	{"logs", "Logs — ingested", "bytes"},
	{"traces", "Traces — ingested", "bytes"},
	{"rum", "RUM — events", "items"},
}

// Usage is month to date per pillar in the org's timezone, against the
// trailing three months' peak. No quotas are invented: the plan column
// says what is true today.
func (s *Service) Usage(ctx context.Context, orgID string, loc *time.Location) (*UsageReport, error) {
	now := s.Now().In(loc)
	month := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, loc)
	rows, err := s.CH.Rows(ctx, orgID, `SELECT pillar, toStartOfMonth(bucket, {tz:String}) AS m, sum(bytes) AS bytes, sum(items) AS items
		FROM usage_hourly WHERE org_id = {o:String} AND bucket >= {f:DateTime64(3)} GROUP BY pillar, m`,
		map[string]string{"o": orgID, "tz": loc.String(), "f": ts(month.AddDate(0, -3, 0))})
	if err != nil {
		return nil, err
	}
	out := &UsageReport{MonthLabel: now.Format("January 2006"), Rows: []UsageMeter{}}
	for _, p := range pillars {
		m := UsageMeter{Pillar: p.key, Label: p.label, Plan: "Unmetered during beta"}
		for _, r := range rows {
			if chdb.Str(r["pillar"]) != p.key {
				continue
			}
			v := f(r, p.unit)
			if chdb.Time(r["m"]).Format("2006-01") == month.Format("2006-01") {
				m.Value = v
			} else if v > m.Peak {
				m.Peak = v
			}
		}
		m.Peak = math.Max(m.Peak, m.Value)
		m.Display = human(m.Value, p.unit)
		out.Rows = append(out.Rows, m)
	}
	return out, nil
}

func human(v float64, unit string) string {
	if unit == "bytes" {
		for _, u := range []string{"B", "KB", "MB", "GB", "TB"} {
			if v < 1000 || u == "TB" {
				return trimFloat(v) + " " + u
			}
			v /= 1000
		}
	}
	for _, u := range []string{"", "K", "M", "B"} {
		if v < 1000 || u == "B" {
			return trimFloat(v) + u
		}
		v /= 1000
	}
	return trimFloat(v)
}

func trimFloat(v float64) string {
	if v >= 100 || v == math.Trunc(v) {
		return fmt.Sprintf("%.0f", v)
	}
	return strings.TrimSuffix(fmt.Sprintf("%.1f", v), ".0")
}
