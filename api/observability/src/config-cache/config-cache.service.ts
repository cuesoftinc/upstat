import { createHash } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { CONFIG, type Config } from "../config/config";
import { StorageService } from "../storage/storage.service";

/** Per unknown key: how often a miss may reread the snapshot. */
const MISS_FLOOR_MS = 30_000;
/** Across all unknown keys: spacing between miss rereads. */
const MISS_GLOBAL_FLOOR_MS = 1_000;
/** After a failed reread, how long before the next try. */
const FAILURE_RETRY_MS = 5_000;
const MISS_MEMORY = 10_000;

/** One ingest key as common's ingest_keys snapshot carries it. */
export interface IngestKey {
  id: string;
  org_id: string;
  kind: "ingestion_token" | "property_key";
  scope: "otlp" | "rum" | "statsd" | "all";
  hash: string;
  previous_hash?: string;
  previous_expires_at?: string;
  status: string;
  allowed_origins: string[];
  quotas: Record<string, number>;
}

export interface RegistryEvent {
  org_id: string;
  name: string;
  dims: string[];
  unique_ineligible: boolean;
}

/**
 * The gateway's in-memory copy of the ingest keys and the event registry
 * (D6 as amended by X-11): loaded from the snapshots common writes.
 * Kafka reaches one instance per group, so correctness never rests on
 * it: every use rechecks the snapshot once the copy is older than
 * CONFIG_MAX_AGE_SECONDS (a revocation reaches every instance within that
 * age), and a key the copy lacks rereads on its own throttle. Postgres is
 * never read.
 */
@Injectable()
export class ConfigCacheService {
  private readonly logger = new Logger(ConfigCacheService.name);
  private keys = new Map<string, IngestKey>();
  private registry = new Map<string, Map<string, RegistryEvent>>();
  private versions = new Map<string, number>();
  private readonly nextCheckAt = new Map<string, number>();
  private readonly inflight = new Map<string, Promise<void>>();
  private readonly missedAt = new Map<string, number>();
  private lastMissRefreshAt = 0;
  private readonly maxAgeMs: number;
  loaded = false;

  constructor(
    private readonly storage: StorageService,
    @Inject(CONFIG) config: Pick<Config, "configMaxAgeMs">,
  ) {
    this.maxAgeMs = config.configMaxAgeMs;
  }

  async load(): Promise<void> {
    await this.reload("ingest_keys");
    await this.reload("registry");
    this.loaded = true;
  }

  /** Reload one kind; kinds the gateway doesn't use are ignored. */
  async reload(kind: string, now = Date.now()): Promise<void> {
    if (kind !== "ingest_keys" && kind !== "registry") return;
    const raw = await this.storage.get(this.storage.configKey(kind));
    const doc = raw
      ? (JSON.parse(raw.toString("utf8")) as {
          version: number;
          items: unknown[];
        })
      : { version: 0, items: [] };
    const known = this.versions.get(kind);
    if (known === undefined || doc.version >= known) {
      this.versions.set(kind, doc.version);
      this.apply(kind, doc);
      if (doc.version !== known) {
        this.logger.log({
          message: "config reloaded",
          kind,
          version: doc.version,
          items: doc.items?.length ?? 0,
        });
      }
    }
    this.nextCheckAt.set(kind, now + this.maxAgeMs);
  }

  private apply(
    kind: string,
    doc: { version: number; items: unknown[] },
  ): void {
    if (kind === "ingest_keys") {
      const keys = new Map<string, IngestKey>();
      for (const key of (doc.items ?? []) as IngestKey[]) {
        keys.set(key.hash, key);
        if (key.previous_hash) keys.set(key.previous_hash, key);
      }
      this.keys = keys;
    } else {
      const registry = new Map<string, Map<string, RegistryEvent>>();
      for (const event of (doc.items ?? []) as RegistryEvent[]) {
        if (!registry.has(event.org_id)) registry.set(event.org_id, new Map());
        registry.get(event.org_id)!.set(event.name, event);
      }
      this.registry = registry;
    }
  }

  private static hash(plain: string): string {
    return createHash("sha256").update(plain).digest("hex");
  }

  /**
   * The key a plaintext names, when it is live for `kind` and `scope`: the
   * current hash, or the previous one inside its 24 h rotation grace.
   */
  lookup(
    plain: string,
    kind: IngestKey["kind"],
    scopes: IngestKey["scope"][],
    now = Date.now(),
  ): IngestKey | "scope" | null {
    const hash = ConfigCacheService.hash(plain);
    const key = this.keys.get(hash);
    if (!key || key.kind !== kind || key.status === "revoked") return null;
    if (
      hash === key.previous_hash &&
      (!key.previous_expires_at || Date.parse(key.previous_expires_at) < now)
    ) {
      return null;
    }
    if (key.scope !== "all" && !scopes.includes(key.scope)) return "scope";
    return key;
  }

  /** Rereads `kind` once its copy is older than the max age (shared by concurrent callers). */
  async ensureFresh(kind: string, now = Date.now()): Promise<void> {
    if (now < (this.nextCheckAt.get(kind) ?? 0)) return;
    await this.refresh(kind, now);
  }

  private refresh(kind: string, now: number): Promise<void> {
    let run = this.inflight.get(kind);
    if (!run) {
      run = this.reload(kind, now)
        .catch((error: Error) => {
          // Keep serving the last copy; retry soon.
          this.nextCheckAt.set(
            kind,
            now + Math.min(FAILURE_RETRY_MS, this.maxAgeMs),
          );
          this.logger.warn({
            message: "config refresh failed",
            kind,
            error: error.message,
          });
        })
        .finally(() => this.inflight.delete(kind));
      this.inflight.set(kind, run);
    }
    return run;
  }

  /**
   * lookup on a copy no older than the max age, so a revoked key stops
   * working on every instance without a Kafka broadcast. A key the copy
   * lacks (created moments ago) rereads the snapshot once per key per 30 s
   * and at most once a second overall, which bounds what bad keys cost.
   */
  async lookupFresh(
    plain: string,
    kind: IngestKey["kind"],
    scopes: IngestKey["scope"][],
    now = Date.now(),
  ): Promise<IngestKey | "scope" | null> {
    const stale = now >= (this.nextCheckAt.get("ingest_keys") ?? 0);
    if (stale) await this.refresh("ingest_keys", now);
    const key = this.lookup(plain, kind, scopes, now);
    if (key !== null || stale) return key;
    const hash = ConfigCacheService.hash(plain);
    if (now - (this.missedAt.get(hash) ?? -Infinity) < MISS_FLOOR_MS)
      return null;
    if (this.missedAt.size >= MISS_MEMORY) this.missedAt.clear();
    this.missedAt.set(hash, now);
    if (now - this.lastMissRefreshAt >= MISS_GLOBAL_FLOOR_MS) {
      this.lastMissRefreshAt = now;
      await this.refresh("ingest_keys", now);
    } else {
      await this.inflight.get("ingest_keys");
    }
    return this.lookup(plain, kind, scopes, now);
  }

  event(orgId: string, name: string): RegistryEvent | undefined {
    return this.registry.get(orgId)?.get(name);
  }

  /** Test seam: replace the snapshots directly. */
  set(keys: IngestKey[], registry: RegistryEvent[], now = Date.now()): void {
    this.nextCheckAt.set("ingest_keys", now + this.maxAgeMs);
    this.nextCheckAt.set("registry", now + this.maxAgeMs);
    this.keys = new Map();
    for (const key of keys) {
      this.keys.set(key.hash, key);
      if (key.previous_hash) this.keys.set(key.previous_hash, key);
    }
    this.registry = new Map();
    for (const event of registry) {
      if (!this.registry.has(event.org_id))
        this.registry.set(event.org_id, new Map());
      this.registry.get(event.org_id)!.set(event.name, event);
    }
    this.loaded = true;
  }
}
