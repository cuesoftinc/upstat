-- Row policies for query_ro (S-9), applied by compose's clickhouse-init
-- after api/common's migrations created the tables. Idempotent.
CREATE ROW POLICY IF NOT EXISTS org ON upstat.otel_logs, upstat.otel_traces, upstat.otel_metrics_gauge, upstat.otel_metrics_sum,
  upstat.otel_metrics_histogram, upstat.metrics_1m, upstat.metrics_1h, upstat.check_results, upstat.check_uptime_daily,
  upstat.events, upstat.events_hourly, upstat.events_daily, upstat.usage_hourly
  USING org_id = getSetting('SQL_upstat_org') TO query_ro;
