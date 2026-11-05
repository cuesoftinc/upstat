// Package clients are api/common's synchronous calls (system-design.md D4):
// the probe functions, api/query's internal surface, and the OpenTelemetry
// Collector that loads check results into ClickHouse. On Cloud Run each
// call carries an ID token for its target; off it, the internal token.
package clients

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/service"
	"github.com/cuesoftinc/upstat/api/common/pkg/gcpauth"
)

type caller struct {
	http   *http.Client
	signer *gcpauth.Signer
	token  string
}

func (c *caller) do(ctx context.Context, method, base, path string, body, out any) error {
	return c.doWith(ctx, method, base, path, nil, body, out)
}

func (c *caller) doWith(ctx context.Context, method, base, path string, headers map[string]string, body, out any) error {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequestWithContext(ctx, method, base+path, reader)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	if c.token != "" {
		req.Header.Set("X-Internal-Token", c.token)
	}
	if err := c.signer.Sign(ctx, req, base); err != nil {
		return fmt.Errorf("id token: %w", err)
	}
	res, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if err != nil {
		return err
	}
	if res.StatusCode >= 300 {
		return &StatusError{Status: res.StatusCode, Body: string(raw)}
	}
	if out == nil {
		return nil
	}
	return json.Unmarshal(raw, out)
}

// StatusError is a non-2xx answer.
type StatusError struct {
	Status int
	Body   string
}

func (e *StatusError) Error() string {
	return fmt.Sprintf("status %d: %s", e.Status, strings.TrimSpace(truncate(e.Body, 300)))
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

// ── Probe ───────────────────────────────────────────────────────────────

type Prober struct {
	caller
	URLs map[string]string
}

func NewProber(urls map[string]string, signer *gcpauth.Signer, token string) *Prober {
	// Each call has its own deadline from the context (timeout + 5 s).
	return &Prober{caller: caller{http: &http.Client{}, signer: signer, token: token}, URLs: urls}
}

func (p *Prober) Check(ctx context.Context, region string, req service.CheckRequest) (*service.CheckResponse, error) {
	base, ok := p.URLs[region]
	if !ok {
		return nil, fmt.Errorf("no probe for region %s", region)
	}
	var out service.CheckResponse
	return &out, p.do(ctx, http.MethodPost, base, "/check", req, &out)
}

func (p *Prober) Run(ctx context.Context, region string, req service.RunRequest) (*service.RunResponse, error) {
	base, ok := p.URLs[region]
	if !ok {
		return nil, fmt.Errorf("no probe for region %s", region)
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	var out service.RunResponse
	return &out, p.do(ctx, http.MethodPost, base, "/run", req, &out)
}

// ── api/query (internal surface) ────────────────────────────────────────

type Query struct {
	caller
	URL string
}

func NewQuery(base string, signer *gcpauth.Signer, token string) *Query {
	return &Query{caller: caller{http: &http.Client{Timeout: 30 * time.Second}, signer: signer, token: token}, URL: base}
}

func (q *Query) get(ctx context.Context, path string, params url.Values, out any) error {
	if q.URL == "" {
		return fmt.Errorf("QUERY_URL is not set")
	}
	return q.do(ctx, http.MethodGet, q.URL, path+"?"+params.Encode(), nil, out)
}

func (q *Query) History(ctx context.Context, orgID, monitorID string) (map[string]any, error) {
	var out map[string]any
	return out, q.get(ctx, "/internal/v1/monitors/"+url.PathEscape(monitorID)+"/history", url.Values{"org_id": {orgID}}, &out)
}

func (q *Query) Uptime(ctx context.Context, orgID string, monitorIDs []string, days int) (map[string]service.UptimeSummary, error) {
	var out map[string]service.UptimeSummary
	return out, q.get(ctx, "/internal/v1/uptime", url.Values{"org_id": {orgID}, "monitor_ids": {strings.Join(monitorIDs, ",")},
		"days": {strconv.Itoa(days)}}, &out)
}

func (q *Query) HasData(ctx context.Context, orgID string) (bool, error) {
	var out struct {
		HasData bool `json:"has_data"`
	}
	return out.HasData, q.get(ctx, "/internal/v1/has-data", url.Values{"org_id": {orgID}}, &out)
}

func (q *Query) Presence(ctx context.Context, orgID string, services []string) (map[string]service.Presence, error) {
	var out map[string]service.Presence
	return out, q.get(ctx, "/internal/v1/presence", url.Values{"org_id": {orgID}, "services": {strings.Join(services, ",")}}, &out)
}

func (q *Query) Replay(ctx context.Context, orgID string, req service.ReplayRequest) (map[string]any, error) {
	if q.URL == "" {
		return nil, fmt.Errorf("QUERY_URL is not set")
	}
	var out map[string]any
	err := q.do(ctx, http.MethodPost, q.URL, "/internal/v1/replay?org_id="+url.QueryEscape(orgID), req, &out)
	return out, err
}

// ── Check results → OTel Collector → ClickHouse (X-11) ──────────────────

// Results posts check results to the collector as OTLP/JSON logs under
// service.name upstat.checks; a ClickHouse materialized view turns those
// rows into check_results (migrations/clickhouse).
type Results struct {
	caller
	Endpoint string
}

func NewResults(endpoint string, signer *gcpauth.Signer) *Results {
	return &Results{caller: caller{http: &http.Client{Timeout: 10 * time.Second}, signer: signer}, Endpoint: endpoint}
}

func (r *Results) Send(ctx context.Context, results []service.CheckResult) error {
	if r.Endpoint == "" || len(results) == 0 {
		return nil
	}
	byOrg := map[string][]service.CheckResult{}
	for _, res := range results {
		byOrg[res.OrgID] = append(byOrg[res.OrgID], res)
	}
	var resourceLogs []any
	for orgID, rs := range byOrg {
		var records []any
		for _, res := range rs {
			ok := "false"
			if res.OK {
				ok = "true"
			}
			attrs := []any{
				kv("upstat.kind", "check_result"), kv("monitor_id", res.MonitorID), kv("tick_id", res.TickID),
				kv("region", res.Region), kv("ok", ok), kv("cause", res.Cause),
				kv("status_code", strconv.Itoa(res.StatusCode)), kv("scheduled_at", res.ScheduledAt.Format(time.RFC3339Nano)),
				kv("dns_ms", ftoa(res.DNSMs)), kv("connect_ms", ftoa(res.ConnectMs)), kv("tls_ms", ftoa(res.TLSMs)),
				kv("ttfb_ms", ftoa(res.TTFBMs)), kv("total_ms", ftoa(res.TotalMs)),
			}
			if res.CertNotAfter != nil {
				attrs = append(attrs, kv("cert_not_after", res.CertNotAfter.UTC().Format(time.RFC3339)))
			}
			records = append(records, map[string]any{
				"timeUnixNano": strconv.FormatInt(res.CheckedAt.UnixNano(), 10), "severityText": "INFO",
				"body": map[string]any{"stringValue": "check_result"}, "attributes": attrs,
			})
		}
		resourceLogs = append(resourceLogs, map[string]any{
			"resource":  map[string]any{"attributes": []any{kv("service.name", "upstat.checks"), kv("upstat.org_id", orgID)}},
			"scopeLogs": []any{map[string]any{"scope": map[string]any{"name": "upstat.scheduler"}, "logRecords": records}},
		})
	}
	// The collector writes reserved service names only from the internal route.
	return r.doWith(ctx, http.MethodPost, r.Endpoint, "/v1/logs", map[string]string{"X-Upstat-Source": "internal"},
		map[string]any{"resourceLogs": resourceLogs}, nil)
}

func kv(key, value string) map[string]any {
	return map[string]any{"key": key, "value": map[string]any{"stringValue": value}}
}

func ftoa(f float64) string { return strconv.FormatFloat(f, 'f', 2, 64) }
