// Package chdb is api/query's ClickHouse client over the HTTP interface,
// with a read-only user. Every query carries its parameters separately
// (param_<name>), the guards from §6.5 (execution time, memory, result
// rows) and the org as SQL_upstat_org, which the row policy checks in
// addition to the predicate the compiler injects (S-9).
package chdb

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type Client struct {
	URL      string
	User     string
	Password string
	HTTP     *http.Client
	// MaxExecution bounds each query (seconds).
	MaxExecution int
}

func New(rawURL, user, password string) *Client {
	return &Client{URL: rawURL, User: user, Password: password, HTTP: &http.Client{Timeout: 30 * time.Second}, MaxExecution: 10}
}

// Error is a ClickHouse failure; Timeout reports an exceeded guard.
type Error struct {
	Status  int
	Message string
}

func (e *Error) Error() string { return fmt.Sprintf("clickhouse %d: %s", e.Status, e.Message) }

func (e *Error) Timeout() bool {
	return strings.Contains(e.Message, "TIMEOUT_EXCEEDED") || strings.Contains(e.Message, "MEMORY_LIMIT_EXCEEDED")
}

// Rows runs sql for orgID and decodes each JSON row.
func (c *Client) Rows(ctx context.Context, orgID, sql string, params map[string]string) ([]map[string]any, error) {
	u, err := url.Parse(c.URL)
	if err != nil {
		return nil, err
	}
	q := u.Query()
	for k, v := range params {
		q.Set("param_"+k, v)
	}
	q.Set("default_format", "JSONEachRow")
	q.Set("output_format_json_quote_64bit_integers", "0")
	q.Set("output_format_json_quote_64bit_floats", "0")
	q.Set("max_execution_time", fmt.Sprint(c.MaxExecution))
	q.Set("max_memory_usage", fmt.Sprint(2<<30))
	q.Set("max_result_rows", "200000")
	q.Set("result_overflow_mode", "break")
	if orgID != "" {
		q.Set("SQL_upstat_org", orgID)
	}
	u.RawQuery = q.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), strings.NewReader(sql))
	if err != nil {
		return nil, err
	}
	if c.User != "" {
		req.SetBasicAuth(c.User, c.Password)
	}
	res, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
		return nil, &Error{Status: res.StatusCode, Message: strings.TrimSpace(string(body))}
	}
	var out []map[string]any
	sc := bufio.NewScanner(res.Body)
	sc.Buffer(make([]byte, 1<<20), 64<<20)
	for sc.Scan() {
		line := bytes.TrimSpace(sc.Bytes())
		if len(line) == 0 {
			continue
		}
		row := map[string]any{}
		dec := json.NewDecoder(bytes.NewReader(line))
		dec.UseNumber()
		if err := dec.Decode(&row); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, sc.Err()
}

// Ping checks the server answers.
func (c *Client) Ping(ctx context.Context) error {
	_, err := c.Rows(ctx, "", "SELECT 1", nil)
	return err
}

// Float reads a numeric column; nil and non-numbers are (0, false).
func Float(v any) (float64, bool) {
	switch n := v.(type) {
	case json.Number:
		f, err := n.Float64()
		return f, err == nil
	case float64:
		return n, true
	case string:
		var f float64
		_, err := fmt.Sscan(n, &f)
		return f, err == nil
	}
	return 0, false
}

// Str reads a column as a string.
func Str(v any) string {
	if v == nil {
		return ""
	}
	if s, ok := v.(string); ok {
		return s
	}
	return fmt.Sprint(v)
}

// Time reads a ClickHouse DateTime/DateTime64 column ("2006-01-02 15:04:05[.fff]").
func Time(v any) time.Time {
	s := Str(v)
	for _, layout := range []string{"2006-01-02 15:04:05.999999999", "2006-01-02 15:04:05", "2006-01-02"} {
		if t, err := time.ParseInLocation(layout, s, time.UTC); err == nil {
			return t
		}
	}
	return time.Time{}
}
