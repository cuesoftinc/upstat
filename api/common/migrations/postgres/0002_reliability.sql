-- Scheduler leases: a claim holds a monitor or check until its pass records
-- the tick or the lease lapses, so a failed pass is retried, not lost.
ALTER TABLE monitors ADD COLUMN leased_until timestamptz;
ALTER TABLE synthetics ADD COLUMN leased_until timestamptz;

-- An outbox row that can never be sent is parked as failed, not published.
ALTER TABLE outbox
  ADD COLUMN attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN failed_at timestamptz,
  ADD COLUMN failure text;
DROP INDEX outbox_unsent;
CREATE INDEX outbox_unsent ON outbox (id) WHERE published_at IS NULL AND failed_at IS NULL;
CREATE INDEX outbox_failed ON outbox (failed_at) WHERE failed_at IS NOT NULL AND published_at IS NULL;

-- A message whose handler kept failing, kept whole so it can be handled again.
CREATE TABLE consumer_failures (
  id              bigserial PRIMARY KEY,
  event           text NOT NULL,
  request_id      text NOT NULL,
  message         text NOT NULL,
  cause           text NOT NULL,
  attempts        integer NOT NULL DEFAULT 1,
  permanent       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  abandoned_at    timestamptz
);
CREATE INDEX consumer_failures_open ON consumer_failures (next_attempt_at)
  WHERE resolved_at IS NULL AND abandoned_at IS NULL;

-- Only entries marked public reach the public status page.
ALTER TABLE timeline_entries ADD COLUMN public boolean NOT NULL DEFAULT false;
