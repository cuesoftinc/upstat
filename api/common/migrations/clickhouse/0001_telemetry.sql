-- Telemetry plane (system-design.md §5.3, as amended by X-11). Go owns
-- this schema; the stock OpenTelemetry Collector loads it with
-- create_schema: false, so the otel_* tables below are the
-- clickhouseexporter's canonical schema (collector 0.130) plus org_id,
-- copied from the upstat.org_id resource attribute the gateway sets, and
-- leading every ORDER BY. Upstat's own rows (check results, product
-- events, usage) arrive as OTLP logs and are split out by materialized
-- views. TTLs follow U-6.

CREATE TABLE IF NOT EXISTS otel_logs
(
    `Timestamp` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    `TimestampTime` DateTime DEFAULT toDateTime(Timestamp),
    `TraceId` String CODEC(ZSTD(1)),
    `SpanId` String CODEC(ZSTD(1)),
    `TraceFlags` UInt8,
    `SeverityText` LowCardinality(String) CODEC(ZSTD(1)),
    `SeverityNumber` UInt8,
    `ServiceName` LowCardinality(String) CODEC(ZSTD(1)),
    `Body` String CODEC(ZSTD(1)),
    `ResourceSchemaUrl` LowCardinality(String) CODEC(ZSTD(1)),
    `ResourceAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `ScopeSchemaUrl` LowCardinality(String) CODEC(ZSTD(1)),
    `ScopeName` String CODEC(ZSTD(1)),
    `ScopeVersion` LowCardinality(String) CODEC(ZSTD(1)),
    `ScopeAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `LogAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `org_id` LowCardinality(String) MATERIALIZED ResourceAttributes['upstat.org_id'],
    INDEX idx_trace_id TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_res_attr_key mapKeys(ResourceAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_res_attr_value mapValues(ResourceAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_log_attr_key mapKeys(LogAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_log_attr_value mapValues(LogAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_body Body TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 8
)
ENGINE = MergeTree
PARTITION BY toDate(TimestampTime)
ORDER BY (org_id, ServiceName, TimestampTime, Timestamp)
TTL TimestampTime + INTERVAL 15 DAY
SETTINGS index_granularity = 8192, ttl_only_drop_parts = 1;

CREATE TABLE IF NOT EXISTS otel_traces
(
    `Timestamp` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    `TraceId` String CODEC(ZSTD(1)),
    `SpanId` String CODEC(ZSTD(1)),
    `ParentSpanId` String CODEC(ZSTD(1)),
    `TraceState` String CODEC(ZSTD(1)),
    `SpanName` LowCardinality(String) CODEC(ZSTD(1)),
    `SpanKind` LowCardinality(String) CODEC(ZSTD(1)),
    `ServiceName` LowCardinality(String) CODEC(ZSTD(1)),
    `ResourceAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `ScopeName` String CODEC(ZSTD(1)),
    `ScopeVersion` String CODEC(ZSTD(1)),
    `SpanAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `Duration` UInt64 CODEC(ZSTD(1)),
    `StatusCode` LowCardinality(String) CODEC(ZSTD(1)),
    `StatusMessage` String CODEC(ZSTD(1)),
    `Events.Timestamp` Array(DateTime64(9)) CODEC(ZSTD(1)),
    `Events.Name` Array(LowCardinality(String)) CODEC(ZSTD(1)),
    `Events.Attributes` Array(Map(LowCardinality(String), String)) CODEC(ZSTD(1)),
    `Links.TraceId` Array(String) CODEC(ZSTD(1)),
    `Links.SpanId` Array(String) CODEC(ZSTD(1)),
    `Links.TraceState` Array(String) CODEC(ZSTD(1)),
    `Links.Attributes` Array(Map(LowCardinality(String), String)) CODEC(ZSTD(1)),
    `org_id` LowCardinality(String) MATERIALIZED ResourceAttributes['upstat.org_id'],
    INDEX idx_trace_id TraceId TYPE bloom_filter(0.001) GRANULARITY 1,
    INDEX idx_res_attr_key mapKeys(ResourceAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_res_attr_value mapValues(ResourceAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_span_attr_key mapKeys(SpanAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_span_attr_value mapValues(SpanAttributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_duration Duration TYPE minmax GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(Timestamp)
ORDER BY (org_id, ServiceName, SpanName, toDateTime(Timestamp))
TTL toDateTime(Timestamp) + INTERVAL 7 DAY
SETTINGS index_granularity = 8192, ttl_only_drop_parts = 1;

CREATE TABLE IF NOT EXISTS otel_traces_trace_id_ts
(
    `TraceId` String CODEC(ZSTD(1)),
    `Start` DateTime CODEC(Delta(4), ZSTD(1)),
    `End` DateTime CODEC(Delta(4), ZSTD(1)),
    INDEX idx_trace_id TraceId TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(Start)
ORDER BY (TraceId, Start)
TTL Start + INTERVAL 7 DAY
SETTINGS index_granularity = 8192, ttl_only_drop_parts = 1;

CREATE MATERIALIZED VIEW IF NOT EXISTS otel_traces_trace_id_ts_mv TO otel_traces_trace_id_ts
AS SELECT TraceId, min(Timestamp) AS Start, max(Timestamp) AS End
FROM otel_traces WHERE TraceId != '' GROUP BY TraceId;

CREATE TABLE IF NOT EXISTS otel_metrics_gauge
(
    `ResourceAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `ResourceSchemaUrl` String CODEC(ZSTD(1)),
    `ScopeName` String CODEC(ZSTD(1)),
    `ScopeVersion` String CODEC(ZSTD(1)),
    `ScopeAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `ScopeDroppedAttrCount` UInt32 CODEC(ZSTD(1)),
    `ScopeSchemaUrl` String CODEC(ZSTD(1)),
    `ServiceName` LowCardinality(String) CODEC(ZSTD(1)),
    `MetricName` String CODEC(ZSTD(1)),
    `MetricDescription` String CODEC(ZSTD(1)),
    `MetricUnit` String CODEC(ZSTD(1)),
    `Attributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `StartTimeUnix` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    `TimeUnix` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    `Value` Float64 CODEC(ZSTD(1)),
    `Flags` UInt32 CODEC(ZSTD(1)),
    `Exemplars.FilteredAttributes` Array(Map(LowCardinality(String), String)) CODEC(ZSTD(1)),
    `Exemplars.TimeUnix` Array(DateTime64(9)) CODEC(ZSTD(1)),
    `Exemplars.Value` Array(Float64) CODEC(ZSTD(1)),
    `Exemplars.SpanId` Array(String) CODEC(ZSTD(1)),
    `Exemplars.TraceId` Array(String) CODEC(ZSTD(1)),
    `org_id` LowCardinality(String) MATERIALIZED ResourceAttributes['upstat.org_id'],
    INDEX idx_attr_key mapKeys(Attributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_attr_value mapValues(Attributes) TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(TimeUnix)
ORDER BY (org_id, ServiceName, MetricName, Attributes, toUnixTimestamp64Nano(TimeUnix))
TTL toDateTime(TimeUnix) + INTERVAL 15 DAY
SETTINGS index_granularity = 8192, ttl_only_drop_parts = 1;

CREATE TABLE IF NOT EXISTS otel_metrics_sum
(
    `ResourceAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `ResourceSchemaUrl` String CODEC(ZSTD(1)),
    `ScopeName` String CODEC(ZSTD(1)),
    `ScopeVersion` String CODEC(ZSTD(1)),
    `ScopeAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `ScopeDroppedAttrCount` UInt32 CODEC(ZSTD(1)),
    `ScopeSchemaUrl` String CODEC(ZSTD(1)),
    `ServiceName` LowCardinality(String) CODEC(ZSTD(1)),
    `MetricName` String CODEC(ZSTD(1)),
    `MetricDescription` String CODEC(ZSTD(1)),
    `MetricUnit` String CODEC(ZSTD(1)),
    `Attributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `StartTimeUnix` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    `TimeUnix` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    `Value` Float64 CODEC(ZSTD(1)),
    `Flags` UInt32 CODEC(ZSTD(1)),
    `Exemplars.FilteredAttributes` Array(Map(LowCardinality(String), String)) CODEC(ZSTD(1)),
    `Exemplars.TimeUnix` Array(DateTime64(9)) CODEC(ZSTD(1)),
    `Exemplars.Value` Array(Float64) CODEC(ZSTD(1)),
    `Exemplars.SpanId` Array(String) CODEC(ZSTD(1)),
    `Exemplars.TraceId` Array(String) CODEC(ZSTD(1)),
    `AggregationTemporality` Int32 CODEC(ZSTD(1)),
    `IsMonotonic` Bool CODEC(Delta(1), ZSTD(1)),
    `org_id` LowCardinality(String) MATERIALIZED ResourceAttributes['upstat.org_id'],
    INDEX idx_attr_key mapKeys(Attributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_attr_value mapValues(Attributes) TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(TimeUnix)
ORDER BY (org_id, ServiceName, MetricName, Attributes, toUnixTimestamp64Nano(TimeUnix))
TTL toDateTime(TimeUnix) + INTERVAL 15 DAY
SETTINGS index_granularity = 8192, ttl_only_drop_parts = 1;

CREATE TABLE IF NOT EXISTS otel_metrics_histogram
(
    `ResourceAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `ResourceSchemaUrl` String CODEC(ZSTD(1)),
    `ScopeName` String CODEC(ZSTD(1)),
    `ScopeVersion` String CODEC(ZSTD(1)),
    `ScopeAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `ScopeDroppedAttrCount` UInt32 CODEC(ZSTD(1)),
    `ScopeSchemaUrl` String CODEC(ZSTD(1)),
    `ServiceName` LowCardinality(String) CODEC(ZSTD(1)),
    `MetricName` String CODEC(ZSTD(1)),
    `MetricDescription` String CODEC(ZSTD(1)),
    `MetricUnit` String CODEC(ZSTD(1)),
    `Attributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `StartTimeUnix` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    `TimeUnix` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    `Count` UInt64 CODEC(Delta(8), ZSTD(1)),
    `Sum` Float64 CODEC(ZSTD(1)),
    `BucketCounts` Array(UInt64) CODEC(ZSTD(1)),
    `ExplicitBounds` Array(Float64) CODEC(ZSTD(1)),
    `Exemplars.FilteredAttributes` Array(Map(LowCardinality(String), String)) CODEC(ZSTD(1)),
    `Exemplars.TimeUnix` Array(DateTime64(9)) CODEC(ZSTD(1)),
    `Exemplars.Value` Array(Float64) CODEC(ZSTD(1)),
    `Exemplars.SpanId` Array(String) CODEC(ZSTD(1)),
    `Exemplars.TraceId` Array(String) CODEC(ZSTD(1)),
    `Flags` UInt32 CODEC(ZSTD(1)),
    `Min` Float64 CODEC(ZSTD(1)),
    `Max` Float64 CODEC(ZSTD(1)),
    `AggregationTemporality` Int32 CODEC(ZSTD(1)),
    `org_id` LowCardinality(String) MATERIALIZED ResourceAttributes['upstat.org_id'],
    INDEX idx_attr_key mapKeys(Attributes) TYPE bloom_filter(0.01) GRANULARITY 1,
    INDEX idx_attr_value mapValues(Attributes) TYPE bloom_filter(0.01) GRANULARITY 1
)
ENGINE = MergeTree
PARTITION BY toDate(TimeUnix)
ORDER BY (org_id, ServiceName, MetricName, Attributes, toUnixTimestamp64Nano(TimeUnix))
TTL toDateTime(TimeUnix) + INTERVAL 15 DAY
SETTINGS index_granularity = 8192, ttl_only_drop_parts = 1;

CREATE TABLE IF NOT EXISTS otel_metrics_exponential_histogram
(
    `ResourceAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `ResourceSchemaUrl` String CODEC(ZSTD(1)),
    `ScopeName` String CODEC(ZSTD(1)),
    `ScopeVersion` String CODEC(ZSTD(1)),
    `ScopeAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `ScopeDroppedAttrCount` UInt32 CODEC(ZSTD(1)),
    `ScopeSchemaUrl` String CODEC(ZSTD(1)),
    `ServiceName` LowCardinality(String) CODEC(ZSTD(1)),
    `MetricName` String CODEC(ZSTD(1)),
    `MetricDescription` String CODEC(ZSTD(1)),
    `MetricUnit` String CODEC(ZSTD(1)),
    `Attributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `StartTimeUnix` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    `TimeUnix` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    `Count` UInt64 CODEC(Delta(8), ZSTD(1)),
    `Sum` Float64 CODEC(ZSTD(1)),
    `Scale` Int32 CODEC(ZSTD(1)),
    `ZeroCount` UInt64 CODEC(ZSTD(1)),
    `PositiveOffset` Int32 CODEC(ZSTD(1)),
    `PositiveBucketCounts` Array(UInt64) CODEC(ZSTD(1)),
    `NegativeOffset` Int32 CODEC(ZSTD(1)),
    `NegativeBucketCounts` Array(UInt64) CODEC(ZSTD(1)),
    `Exemplars.FilteredAttributes` Array(Map(LowCardinality(String), String)) CODEC(ZSTD(1)),
    `Exemplars.TimeUnix` Array(DateTime64(9)) CODEC(ZSTD(1)),
    `Exemplars.Value` Array(Float64) CODEC(ZSTD(1)),
    `Exemplars.SpanId` Array(String) CODEC(ZSTD(1)),
    `Exemplars.TraceId` Array(String) CODEC(ZSTD(1)),
    `Flags` UInt32 CODEC(ZSTD(1)),
    `Min` Float64 CODEC(ZSTD(1)),
    `Max` Float64 CODEC(ZSTD(1)),
    `AggregationTemporality` Int32 CODEC(ZSTD(1)),
    `org_id` LowCardinality(String) MATERIALIZED ResourceAttributes['upstat.org_id']
)
ENGINE = MergeTree
PARTITION BY toDate(TimeUnix)
ORDER BY (org_id, ServiceName, MetricName, Attributes, toUnixTimestamp64Nano(TimeUnix))
TTL toDateTime(TimeUnix) + INTERVAL 15 DAY
SETTINGS index_granularity = 8192, ttl_only_drop_parts = 1;

CREATE TABLE IF NOT EXISTS otel_metrics_summary
(
    `ResourceAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `ResourceSchemaUrl` String CODEC(ZSTD(1)),
    `ScopeName` String CODEC(ZSTD(1)),
    `ScopeVersion` String CODEC(ZSTD(1)),
    `ScopeAttributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `ScopeDroppedAttrCount` UInt32 CODEC(ZSTD(1)),
    `ScopeSchemaUrl` String CODEC(ZSTD(1)),
    `ServiceName` LowCardinality(String) CODEC(ZSTD(1)),
    `MetricName` String CODEC(ZSTD(1)),
    `MetricDescription` String CODEC(ZSTD(1)),
    `MetricUnit` String CODEC(ZSTD(1)),
    `Attributes` Map(LowCardinality(String), String) CODEC(ZSTD(1)),
    `StartTimeUnix` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    `TimeUnix` DateTime64(9) CODEC(Delta(8), ZSTD(1)),
    `Count` UInt64 CODEC(Delta(8), ZSTD(1)),
    `Sum` Float64 CODEC(ZSTD(1)),
    `ValueAtQuantiles.Quantile` Array(Float64) CODEC(ZSTD(1)),
    `ValueAtQuantiles.Value` Array(Float64) CODEC(ZSTD(1)),
    `Flags` UInt32 CODEC(ZSTD(1)),
    `org_id` LowCardinality(String) MATERIALIZED ResourceAttributes['upstat.org_id']
)
ENGINE = MergeTree
PARTITION BY toDate(TimeUnix)
ORDER BY (org_id, ServiceName, MetricName, Attributes, toUnixTimestamp64Nano(TimeUnix))
TTL toDateTime(TimeUnix) + INTERVAL 15 DAY
SETTINGS index_granularity = 8192, ttl_only_drop_parts = 1;

-- Metric rollups: gauges and sums by minute and hour (tier routing, §6.5).
CREATE TABLE IF NOT EXISTS metrics_1m
(
    org_id LowCardinality(String),
    ServiceName LowCardinality(String),
    MetricName String,
    Attributes Map(LowCardinality(String), String),
    bucket DateTime,
    sum_value SimpleAggregateFunction(sum, Float64),
    count_value SimpleAggregateFunction(sum, UInt64),
    min_value SimpleAggregateFunction(min, Float64),
    max_value SimpleAggregateFunction(max, Float64),
    quantiles AggregateFunction(quantiles(0.5, 0.95, 0.99), Float64)
)
ENGINE = AggregatingMergeTree
PARTITION BY toDate(bucket)
ORDER BY (org_id, ServiceName, MetricName, Attributes, bucket)
TTL bucket + INTERVAL 90 DAY;

CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_1m_gauge_mv TO metrics_1m AS
SELECT org_id, ServiceName, MetricName, Attributes, toStartOfMinute(TimeUnix) AS bucket,
    sum(Value) AS sum_value, count() AS count_value, min(Value) AS min_value, max(Value) AS max_value,
    quantilesState(0.5, 0.95, 0.99)(Value) AS quantiles
FROM otel_metrics_gauge GROUP BY org_id, ServiceName, MetricName, Attributes, bucket;

CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_1m_sum_mv TO metrics_1m AS
SELECT org_id, ServiceName, MetricName, Attributes, toStartOfMinute(TimeUnix) AS bucket,
    sum(Value) AS sum_value, count() AS count_value, min(Value) AS min_value, max(Value) AS max_value,
    quantilesState(0.5, 0.95, 0.99)(Value) AS quantiles
FROM otel_metrics_sum GROUP BY org_id, ServiceName, MetricName, Attributes, bucket;

CREATE TABLE IF NOT EXISTS metrics_1h
(
    org_id LowCardinality(String),
    ServiceName LowCardinality(String),
    MetricName String,
    Attributes Map(LowCardinality(String), String),
    bucket DateTime,
    sum_value SimpleAggregateFunction(sum, Float64),
    count_value SimpleAggregateFunction(sum, UInt64),
    min_value SimpleAggregateFunction(min, Float64),
    max_value SimpleAggregateFunction(max, Float64),
    quantiles AggregateFunction(quantiles(0.5, 0.95, 0.99), Float64)
)
ENGINE = AggregatingMergeTree
PARTITION BY toYYYYMM(bucket)
ORDER BY (org_id, ServiceName, MetricName, Attributes, bucket)
TTL bucket + INTERVAL 13 MONTH;

CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_1h_gauge_mv TO metrics_1h AS
SELECT org_id, ServiceName, MetricName, Attributes, toStartOfHour(TimeUnix) AS bucket,
    sum(Value) AS sum_value, count() AS count_value, min(Value) AS min_value, max(Value) AS max_value,
    quantilesState(0.5, 0.95, 0.99)(Value) AS quantiles
FROM otel_metrics_gauge GROUP BY org_id, ServiceName, MetricName, Attributes, bucket;

CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_1h_sum_mv TO metrics_1h AS
SELECT org_id, ServiceName, MetricName, Attributes, toStartOfHour(TimeUnix) AS bucket,
    sum(Value) AS sum_value, count() AS count_value, min(Value) AS min_value, max(Value) AS max_value,
    quantilesState(0.5, 0.95, 0.99)(Value) AS quantiles
FROM otel_metrics_sum GROUP BY org_id, ServiceName, MetricName, Attributes, bucket;

-- Check results: common sends each region's answer as an OTLP log under
-- service upstat.checks (§6.1).
CREATE TABLE IF NOT EXISTS check_results
(
    org_id LowCardinality(String),
    monitor_id String,
    tick_id String,
    region LowCardinality(String),
    scheduled_at DateTime64(3),
    checked_at DateTime64(3),
    ok UInt8,
    cause LowCardinality(String),
    status_code UInt16,
    dns_ms Float32,
    connect_ms Float32,
    tls_ms Float32,
    ttfb_ms Float32,
    total_ms Float32,
    cert_not_after Nullable(DateTime)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(scheduled_at)
ORDER BY (org_id, monitor_id, scheduled_at, region)
TTL toDateTime(scheduled_at) + INTERVAL 90 DAY;

CREATE MATERIALIZED VIEW IF NOT EXISTS check_results_mv TO check_results AS
SELECT org_id,
    LogAttributes['monitor_id'] AS monitor_id,
    LogAttributes['tick_id'] AS tick_id,
    LogAttributes['region'] AS region,
    parseDateTime64BestEffortOrZero(LogAttributes['scheduled_at'], 3) AS scheduled_at,
    toDateTime64(Timestamp, 3) AS checked_at,
    LogAttributes['ok'] = 'true' AS ok,
    LogAttributes['cause'] AS cause,
    toUInt16OrZero(LogAttributes['status_code']) AS status_code,
    toFloat32OrZero(LogAttributes['dns_ms']) AS dns_ms,
    toFloat32OrZero(LogAttributes['connect_ms']) AS connect_ms,
    toFloat32OrZero(LogAttributes['tls_ms']) AS tls_ms,
    toFloat32OrZero(LogAttributes['ttfb_ms']) AS ttfb_ms,
    toFloat32OrZero(LogAttributes['total_ms']) AS total_ms,
    parseDateTimeBestEffortOrNull(LogAttributes['cert_not_after']) AS cert_not_after
FROM otel_logs
WHERE ServiceName = 'upstat.checks' AND LogAttributes['upstat.kind'] = 'check_result';

-- Daily uptime for the 90-day strips: passing ÷ completed region results.
CREATE TABLE IF NOT EXISTS check_uptime_daily
(
    org_id LowCardinality(String),
    monitor_id String,
    day Date,
    checks SimpleAggregateFunction(sum, UInt64),
    passing SimpleAggregateFunction(sum, UInt64),
    latency AggregateFunction(quantiles(0.5, 0.95), Float32)
)
ENGINE = AggregatingMergeTree
ORDER BY (org_id, monitor_id, day)
TTL day + INTERVAL 13 MONTH;

CREATE MATERIALIZED VIEW IF NOT EXISTS check_uptime_daily_mv TO check_uptime_daily AS
SELECT org_id, monitor_id, toDate(scheduled_at) AS day, count() AS checks, sum(ok) AS passing,
    quantilesState(0.5, 0.95)(total_ms) AS latency
FROM check_results GROUP BY org_id, monitor_id, day;

-- Product events and RUM (§6.4): the gateway sends each accepted event as
-- an OTLP log under service upstat.events, after hashing the visitor and
-- dropping IP and user agent. The schema is the privacy boundary.
CREATE TABLE IF NOT EXISTS events
(
    org_id LowCardinality(String),
    property_id String,
    name LowCardinality(String),
    ts DateTime64(3),
    visitor_hash String,
    path String,
    referrer_host LowCardinality(String),
    device_class LowCardinality(String),
    country LowCardinality(String),
    value Float64,
    dims Map(LowCardinality(String), String)
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(ts)
ORDER BY (org_id, property_id, name, ts)
TTL toDateTime(ts) + INTERVAL 90 DAY;

CREATE MATERIALIZED VIEW IF NOT EXISTS events_mv TO events AS
SELECT org_id,
    LogAttributes['property_id'] AS property_id,
    LogAttributes['name'] AS name,
    toDateTime64(Timestamp, 3) AS ts,
    LogAttributes['visitor_hash'] AS visitor_hash,
    LogAttributes['path'] AS path,
    LogAttributes['referrer_host'] AS referrer_host,
    LogAttributes['device_class'] AS device_class,
    LogAttributes['country'] AS country,
    toFloat64OrZero(LogAttributes['value']) AS value,
    mapFilter((k, v) -> startsWith(k, 'dim.'), LogAttributes) AS dims
FROM otel_logs
WHERE ServiceName = 'upstat.events' AND LogAttributes['upstat.kind'] = 'event';

-- Hourly and daily rollups; uniques are exact within a bucket
-- (analytics-math.md §3) and never added across buckets (§4).
CREATE TABLE IF NOT EXISTS events_hourly
(
    org_id LowCardinality(String),
    property_id String,
    name LowCardinality(String),
    bucket DateTime,
    events SimpleAggregateFunction(sum, UInt64),
    uniques AggregateFunction(uniqExact, String)
)
ENGINE = AggregatingMergeTree
ORDER BY (org_id, property_id, name, bucket)
TTL bucket + INTERVAL 90 DAY;

CREATE MATERIALIZED VIEW IF NOT EXISTS events_hourly_mv TO events_hourly AS
SELECT org_id, property_id, name, toStartOfHour(ts) AS bucket, count() AS events,
    uniqExactStateIf(visitor_hash, visitor_hash != '') AS uniques
FROM events GROUP BY org_id, property_id, name, bucket;

CREATE TABLE IF NOT EXISTS events_daily
(
    org_id LowCardinality(String),
    property_id String,
    name LowCardinality(String),
    bucket Date,
    events SimpleAggregateFunction(sum, UInt64),
    uniques AggregateFunction(uniqExact, String)
)
ENGINE = AggregatingMergeTree
ORDER BY (org_id, property_id, name, bucket)
TTL bucket + INTERVAL 13 MONTH;

CREATE MATERIALIZED VIEW IF NOT EXISTS events_daily_mv TO events_daily AS
SELECT org_id, property_id, name, toDate(ts) AS bucket, count() AS events,
    uniqExactStateIf(visitor_hash, visitor_hash != '') AS uniques
FROM events GROUP BY org_id, property_id, name, bucket;

-- Usage metering (B12): the gateway reports accepted bytes per key and
-- pillar as OTLP logs under service upstat.usage.
CREATE TABLE IF NOT EXISTS usage_hourly
(
    org_id LowCardinality(String),
    key_id String,
    pillar LowCardinality(String),
    bucket DateTime,
    bytes UInt64,
    items UInt64
)
ENGINE = SummingMergeTree
ORDER BY (org_id, pillar, key_id, bucket)
TTL bucket + INTERVAL 13 MONTH;

CREATE MATERIALIZED VIEW IF NOT EXISTS usage_hourly_mv TO usage_hourly AS
SELECT org_id, LogAttributes['key_id'] AS key_id, LogAttributes['pillar'] AS pillar,
    toStartOfHour(Timestamp) AS bucket,
    toUInt64OrZero(LogAttributes['bytes']) AS bytes, toUInt64OrZero(LogAttributes['items']) AS items
FROM otel_logs
WHERE ServiceName = 'upstat.usage' AND LogAttributes['upstat.kind'] = 'usage';
