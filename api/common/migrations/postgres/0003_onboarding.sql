-- Onboarding caches the first "has data" answer so polling stops waking
-- ClickHouse once an org has sent telemetry. Existing orgs are not backfilled;
-- the flag is set on their next poll.
ALTER TABLE orgs ADD COLUMN has_data boolean NOT NULL DEFAULT false;
