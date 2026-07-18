/** API keys & ingestion tokens — data-model.md §5 INGEST_KEY + §2 PROPERTY keys. */

export type KeyKind = "ingestion_token" | "property_key";
export type KeyScope = "otlp" | "rum" | "statsd" | "all";
/** Rotation contract: previous key valid 24h after rotation (data-model.md §2). */
export type KeyStatus = "active" | "rotation_grace" | "revoked";

export interface ApiKey {
  id: string;
  kind: KeyKind;
  name: string;
  scope: KeyScope;
  /** Masked display form, e.g. `uk_live_3f…9c`; full value only at creation. */
  key_masked: string;
  status: KeyStatus;
  created_at: string;
  /** Per-key rejection counter (analytics-math.md §6 — no silent data loss). */
  rejected_count: number;
}

/** Returned once at creation/rotation — the only time the secret is visible. */
export interface ApiKeyWithSecret extends ApiKey {
  key: string;
}
