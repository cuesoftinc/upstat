-- Control plane (system-design.md §5.2). api/common is the only client.
-- Every tenant table carries org_id and row-level security: a request
-- transaction sets upstat.org_id, a system transaction sets upstat.bypass.

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,  -- Google-verified, lowercased
  name          text NOT NULL DEFAULT '',
  active_org_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sso_handoffs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  body_code_hash   text NOT NULL UNIQUE,
  cookie_code_hash text NOT NULL UNIQUE,
  user_id          text NOT NULL,
  email            text NOT NULL,
  name             text NOT NULL DEFAULT '',
  challenge        text NOT NULL,
  channel          text,
  token_ciphertext bytea,
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sso_handoffs_expires ON sso_handoffs (expires_at);

CREATE TABLE orgs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  timezone   text NOT NULL DEFAULT 'UTC',
  created_by uuid REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users (id) ON DELETE CASCADE,
  email      text NOT NULL,
  name       text NOT NULL DEFAULT '',
  role       text NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  status     text NOT NULL CHECK (status IN ('active', 'invited', 'disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);
CREATE INDEX members_user ON members (user_id);
CREATE INDEX members_email ON members (email);

-- Ingest keys: ingestion tokens (OTLP) and property keys (/v1/events).
-- Only sha256 of a key is stored; the plaintext is shown once.
CREATE TABLE ingest_keys (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  kind                text NOT NULL CHECK (kind IN ('ingestion_token', 'property_key')),
  name                text NOT NULL,
  scope               text NOT NULL CHECK (scope IN ('otlp', 'rum', 'statsd', 'all')),
  key_hash            text NOT NULL UNIQUE,
  key_masked          text NOT NULL,
  previous_hash       text,
  previous_expires_at timestamptz,
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotation_grace', 'revoked')),
  allowed_origins     jsonb NOT NULL DEFAULT '[]',
  quotas              jsonb NOT NULL DEFAULT '{}',
  rejected_count      bigint NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ingest_keys_org ON ingest_keys (org_id);

-- The event registry is the ingest schema (api.md §3.4a).
CREATE TABLE event_registry (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  name              text NOT NULL,
  dims              text[] NOT NULL DEFAULT '{}',
  unique_ineligible boolean NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE TABLE monitors (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  name                  text NOT NULL,
  target                text NOT NULL,
  type                  text NOT NULL DEFAULT 'website' CHECK (type IN ('website', 'server', 'api', 'blog')),
  active                boolean NOT NULL DEFAULT true,
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('up', 'down', 'pending', 'nodata', 'paused')),
  muted                 boolean NOT NULL DEFAULT false,
  interval_s            integer NOT NULL DEFAULT 60,
  timeout_s             integer NOT NULL DEFAULT 10,
  failure_threshold     integer NOT NULL DEFAULT 3,
  consecutive_failures  integer NOT NULL DEFAULT 0,
  regions               text[] NOT NULL DEFAULT '{}',  -- empty = every configured region
  min_failing_regions   integer NOT NULL DEFAULT 2,
  next_run_at           timestamptz NOT NULL DEFAULT now(),
  last_transition_seq   bigint NOT NULL DEFAULT 0,
  last_checked_at       timestamptz,
  last_response_time_ms integer,
  last_status_code      integer,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);
-- The scheduler's lookup (§6.1): active monitors that are due.
CREATE INDEX monitors_due ON monitors (next_run_at) WHERE active;

-- Status history: every transition the evaluator decided, in order.
CREATE TABLE transitions (
  id                   uuid PRIMARY KEY,
  org_id               uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  monitor_id           uuid NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
  seq                  bigint NOT NULL,
  from_status          text NOT NULL,
  to_status            text NOT NULL,
  cause                text NOT NULL DEFAULT '',
  regions              jsonb NOT NULL DEFAULT '{}',
  consecutive_failures integer NOT NULL DEFAULT 0,
  at                   timestamptz NOT NULL,
  UNIQUE (monitor_id, seq)
);

CREATE TABLE channels (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  kind                 text NOT NULL CHECK (kind IN ('email', 'webhook')),
  name                 text NOT NULL DEFAULT '',
  target               text NOT NULL,
  secret               text NOT NULL DEFAULT '',  -- webhook signing secret
  health               text NOT NULL DEFAULT 'unverified' CHECK (health IN ('unverified', 'verified', 'degraded')),
  failure_note         text NOT NULL DEFAULT '',
  consecutive_failures integer NOT NULL DEFAULT 0,
  verify_requested_at  timestamptz,
  verified_once        boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE rules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  name              text NOT NULL,
  signal            text NOT NULL CHECK (signal IN ('uptime', 'metric', 'log', 'trace', 'slo_burn')),
  query             jsonb,
  query_string      text NOT NULL DEFAULT '',
  thresholds        jsonb NOT NULL,
  notify            jsonb NOT NULL,
  state             text NOT NULL DEFAULT 'ok' CHECK (state IN ('ok', 'warn', 'alert', 'nodata')),
  last_triggered_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Alert feed and channel health (§6.2): one row per delivery outcome.
CREATE TABLE deliveries (
  id            uuid PRIMARY KEY,
  org_id        uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  transition_id uuid,
  rule_id       uuid,
  channel_id    uuid,
  kind          text NOT NULL,  -- alert | flapping | renotify | verify | rule
  sev           text NOT NULL DEFAULT 'sev2',
  monitor_name  text NOT NULL DEFAULT '',
  message       text NOT NULL DEFAULT '',
  state         text NOT NULL CHECK (state IN ('delivered', 'failed', 'suppressed')),
  attempts      integer NOT NULL DEFAULT 0,
  at            timestamptz NOT NULL,
  read_at       timestamptz
);
CREATE INDEX deliveries_feed ON deliveries (org_id, at DESC);

CREATE TABLE incidents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  number         integer NOT NULL,
  title          text NOT NULL,
  sev            integer NOT NULL CHECK (sev BETWEEN 1 AND 4),
  status         text NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  commander      text NOT NULL DEFAULT '',
  responders     text[] NOT NULL DEFAULT '{}',
  source         text NOT NULL DEFAULT 'manual' CHECK (source IN ('monitor', 'manual')),
  monitor_id     uuid REFERENCES monitors (id) ON DELETE SET NULL,
  cause          text NOT NULL DEFAULT '',
  services       text[] NOT NULL DEFAULT '{}',
  postmortem_key text,
  started_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at    timestamptz,
  UNIQUE (org_id, number)
);
-- At most one open auto-incident per monitor.
CREATE UNIQUE INDEX incidents_open_monitor ON incidents (monitor_id) WHERE source = 'monitor' AND status <> 'resolved';

CREATE TABLE timeline_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  incident_id uuid NOT NULL REFERENCES incidents (id) ON DELETE CASCADE,
  ts          timestamptz NOT NULL DEFAULT now(),
  author      text NOT NULL,
  phase       text NOT NULL,
  body        text NOT NULL
);
CREATE INDEX timeline_incident ON timeline_entries (incident_id, ts);

CREATE TABLE slos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id               uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  name                 text NOT NULL,
  sli_source           text NOT NULL CHECK (sli_source IN ('check', 'metric_ratio', 'latency')),
  target               double precision NOT NULL,
  window_spec          text NOT NULL DEFAULT '30d',
  monitor_id           uuid REFERENCES monitors (id) ON DELETE SET NULL,
  query                text NOT NULL DEFAULT '',
  current              double precision NOT NULL DEFAULT 100,
  budget_remaining_pct double precision NOT NULL DEFAULT 100,
  burn_rate            double precision NOT NULL DEFAULT 0,
  state                text NOT NULL DEFAULT 'healthy' CHECK (state IN ('healthy', 'burning', 'exhausted')),
  exhausted_at         timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE dashboards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  name          text NOT NULL,
  favorite      boolean NOT NULL DEFAULT false,
  shared        boolean NOT NULL DEFAULT false,
  template_vars jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE TABLE widgets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  dashboard_id uuid NOT NULL REFERENCES dashboards (id) ON DELETE CASCADE,
  type         text NOT NULL,
  title        text NOT NULL DEFAULT '',
  query        jsonb,
  query_string text,
  viz_options  jsonb NOT NULL DEFAULT '{}',
  layout       jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX widgets_dashboard ON widgets (dashboard_id, created_at);

CREATE TABLE saved_views (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name       text NOT NULL,
  scope      text NOT NULL CHECK (scope IN ('personal', 'org')),
  surface    text NOT NULL CHECK (surface IN ('logs', 'metrics', 'traces')),
  query      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, surface, name)
);

CREATE TABLE catalog (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  name         text NOT NULL,
  owner        text NOT NULL DEFAULT '',
  links        jsonb NOT NULL DEFAULT '{}',
  environments text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE TABLE status_pages (
  org_id     uuid PRIMARY KEY REFERENCES orgs (id) ON DELETE CASCADE,
  name       text NOT NULL,
  slug       text NOT NULL UNIQUE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE status_components (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  position   integer NOT NULL,
  name       text NOT NULL,
  monitor_id uuid REFERENCES monitors (id) ON DELETE SET NULL
);
CREATE INDEX status_components_org ON status_components (org_id, position);

CREATE TABLE synthetics (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  name            text NOT NULL,
  kind            text NOT NULL CHECK (kind IN ('multi_step', 'browser')),
  steps           jsonb NOT NULL DEFAULT '[]',
  browser         jsonb,
  interval_s      integer NOT NULL DEFAULT 300,
  next_run_at     timestamptz NOT NULL DEFAULT now(),
  runs            integer NOT NULL DEFAULT 0,
  last_run_id     uuid,
  last_run_status text,
  last_run_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);
CREATE INDEX synthetics_due ON synthetics (next_run_at);

CREATE TABLE synthetic_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  check_id           uuid NOT NULL REFERENCES synthetics (id) ON DELETE CASCADE,
  number             integer NOT NULL,
  status             text NOT NULL CHECK (status IN ('pass', 'fail')),
  started_at         timestamptz NOT NULL,
  total_ms           integer NOT NULL,
  steps              jsonb NOT NULL,
  steps_total        integer NOT NULL,
  failure_screenshot jsonb,
  UNIQUE (check_id, number)
);

CREATE TABLE insights (
  id                 uuid PRIMARY KEY,
  org_id             uuid NOT NULL REFERENCES orgs (id) ON DELETE CASCADE,
  monitor_id         uuid NOT NULL REFERENCES monitors (id) ON DELETE CASCADE,
  risk_score         integer NOT NULL,
  severity           text NOT NULL,
  anomaly_detected   boolean NOT NULL,
  summary            text NOT NULL,
  narrative          text NOT NULL,
  recommended_action text NOT NULL,
  generated_at       timestamptz NOT NULL
);
CREATE INDEX insights_monitor ON insights (monitor_id, generated_at DESC);

-- Transactional outbox (§6.8): sent iff the business write commits.
CREATE TABLE outbox (
  id           bigserial PRIMARY KEY,
  event        text NOT NULL,
  message_key  text NOT NULL,
  request_id   text NOT NULL,
  payload      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);
CREATE INDEX outbox_unsent ON outbox (id) WHERE published_at IS NULL;

-- The first result per request_id wins (shared messaging contract).
CREATE TABLE result_claim (
  request_id text NOT NULL,
  event      text NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, event)
);

-- Row-level security on every tenant table (S-9).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['members', 'ingest_keys', 'event_registry', 'monitors', 'transitions', 'channels', 'rules',
    'deliveries', 'incidents', 'timeline_entries', 'slos', 'dashboards', 'widgets', 'saved_views', 'catalog',
    'status_pages', 'status_components', 'synthetics', 'synthetic_runs', 'insights']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$CREATE POLICY tenant ON %I USING (
      current_setting('upstat.bypass', true) = 'on'
      OR org_id = nullif(current_setting('upstat.org_id', true), '')::uuid)$p$, t);
  END LOOP;
END $$;
