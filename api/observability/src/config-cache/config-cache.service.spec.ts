import { createHash } from "node:crypto";
import type { StorageService } from "../storage/storage.service";
import { ConfigCacheService, type IngestKey } from "./config-cache.service";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const key = (id: string, plain: string, status = "active"): IngestKey => ({
  id,
  org_id: "org",
  kind: "ingestion_token",
  scope: "otlp",
  hash: sha(plain),
  status,
  allowed_origins: [],
  quotas: {},
});

const setup = () => {
  const snapshots = new Map<string, unknown>();
  let reads = 0;
  const state = { fail: false };
  const storage = {
    configKey: (kind: string) => kind,
    get: async (name: string) => {
      reads++;
      if (state.fail) throw new Error("storage down");
      return snapshots.has(name)
        ? Buffer.from(JSON.stringify(snapshots.get(name)))
        : null;
    },
  } as unknown as StorageService;
  const cache = new ConfigCacheService(storage, { configMaxAgeMs: 30_000 });
  return { snapshots, state, cache, reads: () => reads };
};

const lookup = (cache: ConfigCacheService, plain: string, now: number) =>
  cache.lookupFresh(plain, "ingestion_token", ["otlp"], now);

describe("ConfigCacheService", () => {
  it("serves a hit from memory inside the max age, then rechecks", async () => {
    const { snapshots, cache, reads } = setup();
    snapshots.set("ingest_keys", { version: 1, items: [key("a", "uk_a")] });
    await cache.load();
    const t0 = Date.now();
    const loads = reads();
    expect(await lookup(cache, "uk_a", t0 + 10_000)).toMatchObject({ id: "a" });
    expect(reads()).toBe(loads);
    await lookup(cache, "uk_a", t0 + 31_000);
    expect(reads()).toBe(loads + 1);
  });

  it("stops serving a revoked key on a warm instance after the max age", async () => {
    const { snapshots, cache } = setup();
    snapshots.set("ingest_keys", { version: 1, items: [key("a", "uk_a")] });
    await cache.load();
    const t0 = Date.now();
    expect(await lookup(cache, "uk_a", t0 + 1)).toMatchObject({ id: "a" });
    snapshots.set("ingest_keys", {
      version: 2,
      items: [key("a", "uk_a", "revoked")],
    });
    expect(await lookup(cache, "uk_a", t0 + 31_000)).toBeNull();
  });

  it("keeps serving the last copy when the recheck fails", async () => {
    const { snapshots, state, cache } = setup();
    snapshots.set("ingest_keys", { version: 1, items: [key("a", "uk_a")] });
    await cache.load();
    const t0 = Date.now();
    state.fail = true;
    expect(await lookup(cache, "uk_a", t0 + 31_000)).toMatchObject({
      id: "a",
    });
  });

  it("finds a key created after an earlier miss without waiting out a global floor", async () => {
    const { snapshots, cache } = setup();
    snapshots.set("ingest_keys", { version: 1, items: [key("a", "uk_a")] });
    await cache.load();
    const t0 = Date.now();
    expect(await lookup(cache, "uk_unknown", t0)).toBeNull();
    snapshots.set("ingest_keys", {
      version: 2,
      items: [key("a", "uk_a"), key("b", "uk_b")],
    });
    expect(await lookup(cache, "uk_b", t0 + 2_000)).toMatchObject({ id: "b" });
  });

  it("throttles repeated misses of one key and bursts of different keys", async () => {
    const { snapshots, cache, reads } = setup();
    snapshots.set("ingest_keys", { version: 1, items: [key("a", "uk_a")] });
    await cache.load();
    const t0 = Date.now();
    const base = reads();
    await lookup(cache, "uk_x", t0);
    await lookup(cache, "uk_y", t0 + 300);
    await lookup(cache, "uk_x", t0 + 5_000);
    expect(reads()).toBe(base + 1);
  });
});
