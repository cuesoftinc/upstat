-- Onboarding caches the first "has data" answer so polling stops waking
-- ClickHouse once an org has sent telemetry (issue #405).
ALTER TABLE orgs ADD COLUMN has_data boolean NOT NULL DEFAULT false;
