import { createHash } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { StorageService } from "../storage/storage.service";

const REFRESH_FLOOR_MS = 30_000;

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
 * (D6 as amended by X-11): loaded from the snapshots common writes, and
 * reloaded when upstat.config.changed names them. Postgres is never read.
 */
@Injectable()
export class ConfigCacheService {
  private readonly logger = new Logger(ConfigCacheService.name);
  private keys = new Map<string, IngestKey>();
  private registry = new Map<string, Map<string, RegistryEvent>>();
  private versions = new Map<string, number>();
  private refreshedAt = 0;
  loaded = false;

  constructor(private readonly storage: StorageService) {}

  async load(): Promise<void> {
    await this.reload("ingest_keys");
    await this.reload("registry");
    this.loaded = true;
  }

  /** Reload one kind; kinds the gateway doesn't use are ignored. */
  async reload(kind: string): Promise<void> {
    if (kind !== "ingest_keys" && kind !== "registry") return;
    const raw = await this.storage.get(this.storage.configKey(kind));
    const doc = raw
      ? (JSON.parse(raw.toString("utf8")) as {
          version: number;
          items: unknown[];
        })
      : { version: 0, items: [] };
    if (doc.version < (this.versions.get(kind) ?? 0)) return;
    this.versions.set(kind, doc.version);
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
    this.logger.log({
      message: "config reloaded",
      kind,
      items: doc.items?.length ?? 0,
    });
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
    const hash = createHash("sha256").update(plain).digest("hex");
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

  /**
   * lookup, but a miss rereads the keys snapshot first (at most every 30 s
   * per instance). On request-based CPU (S-14) the config consumer only
   * runs while a request is in flight, so a key created moments ago may
   * not have arrived yet; the floor bounds what bad keys can cost.
   */
  async lookupFresh(
    plain: string,
    kind: IngestKey["kind"],
    scopes: IngestKey["scope"][],
    now = Date.now(),
  ): Promise<IngestKey | "scope" | null> {
    const key = this.lookup(plain, kind, scopes, now);
    if (key !== null || now - this.refreshedAt < REFRESH_FLOOR_MS) return key;
    this.refreshedAt = now;
    try {
      await this.reload("ingest_keys");
    } catch (error) {
      this.logger.warn({
        message: "keys refresh failed",
        error: (error as Error).message,
      });
      return null;
    }
    return this.lookup(plain, kind, scopes, now);
  }

  event(orgId: string, name: string): RegistryEvent | undefined {
    return this.registry.get(orgId)?.get(name);
  }

  /** Test seam: replace the snapshots directly. */
  set(keys: IngestKey[], registry: RegistryEvent[]): void {
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
