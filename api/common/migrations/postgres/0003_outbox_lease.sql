-- The outbox publisher leases a batch instead of holding its row locks while
-- it writes to storage and Kafka; a lease that lapses lets another pass retry,
-- and the owner token keeps a late pass from freeing or marking another's rows.
SET LOCAL lock_timeout = '10s';
ALTER TABLE outbox ADD COLUMN lease_until timestamptz, ADD COLUMN lease_owner text;

-- One snapshot rewrite at a time per config kind: the lease replaces the
-- advisory lock held across the storage write, and version hands out the
-- snapshot versions, which only rise.
CREATE TABLE config_snapshot (
  kind        text PRIMARY KEY,
  version     bigint NOT NULL,
  lease_until timestamptz,
  lease_owner text
);
