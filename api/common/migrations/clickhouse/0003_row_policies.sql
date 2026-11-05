-- Row policies for the read-only query user (S-9): every table with an
-- org_id column, each row visible only to the org named by the
-- SQL_upstat_org setting. {{query_user}} is the CLICKHOUSE_QUERY_USER name.
CREATE ROW POLICY IF NOT EXISTS org ON otel_logs, otel_traces, otel_traces_trace_id_ts, otel_metrics_gauge, otel_metrics_sum,
  otel_metrics_histogram, otel_metrics_exponential_histogram, otel_metrics_summary, metrics_1m, metrics_1h,
  check_results, check_uptime_daily, events, events_hourly, events_daily, usage_hourly
  USING org_id = getSetting('SQL_upstat_org') TO {{query_user}};
