-- The trace window index carries the org, so a lookup is scoped to one org.
ALTER TABLE otel_traces_trace_id_ts ADD COLUMN IF NOT EXISTS org_id LowCardinality(String);

DROP VIEW IF EXISTS otel_traces_trace_id_ts_mv;

CREATE MATERIALIZED VIEW IF NOT EXISTS otel_traces_trace_id_ts_mv TO otel_traces_trace_id_ts
AS SELECT org_id, TraceId, min(Timestamp) AS Start, max(Timestamp) AS End
FROM otel_traces WHERE TraceId != '' GROUP BY org_id, TraceId;
