-- The outbox publisher leases a batch instead of holding its row locks while
-- it writes to storage and Kafka; a lease that lapses lets another pass retry.
ALTER TABLE outbox ADD COLUMN lease_until timestamptz;

-- One snapshot rewrite at a time per config kind: the lease replaces the
-- advisory lock held across the storage write, and version hands out the
-- snapshot versions, which only rise.
CREATE TABLE config_snapshot (
  kind        text PRIMARY KEY,
  version     bigint NOT NULL,
  lease_until timestamptz
);
