import { unavailable } from "../errors/api-error";
import { loadConfig } from "../config/config";
import { ValkeyService } from "../valkey/valkey.service";
import { QuotaService } from "./quota.service";

const status = (run: Promise<unknown>): Promise<number> =>
  run.then(
    () => 0,
    (error: { getStatus?: () => number }) => error.getStatus?.() ?? -1,
  );

describe("QuotaService", () => {
  it("answers 503 and never counts locally while a required Valkey errors", async () => {
    const valkey = {
      enabled: true,
      key: (name: string) => `upstat:${name}`,
      eval: async () => {
        throw unavailable(2);
      },
    } as unknown as ValkeyService;
    const quota = new QuotaService(valkey);
    expect(await status(quota.take("k", 1, 10, 1))).toBe(503);
    expect(await status(quota.take("k", 1, 10, 1))).toBe(503);
    expect(await status(quota.salt("2026-11-05"))).toBe(503);
    expect(await status(quota.salt("2026-11-05"))).toBe(503);
  });

  it("answers 503 with a retry hint when Valkey is unreachable", async () => {
    const valkey = new ValkeyService(
      loadConfig({
        KAFKA_BROKERS: "localhost:1",
        STORAGE_BUCKET: "b",
        STORAGE_PREFIX: "upstat/test",
        OTLP_LOADER_ENDPOINT: "http://localhost:4318",
        REDIS_HOST: "127.0.0.1",
        REDIS_PORT: "1",
      }),
    );
    try {
      const quota = new QuotaService(valkey);
      const error = await quota.take("k", 1, 10, 1).catch((e: unknown) => e);
      expect(error).toMatchObject({
        status: 503,
        response: { error: { details: { retry_after: 2 } } },
      });
    } finally {
      await valkey.onModuleDestroy();
    }
  }, 15_000);

  it("keeps local windows only without a Valkey host", async () => {
    const quota = new QuotaService({ enabled: false } as ValkeyService);
    expect((await quota.take("k", 6, 10, 1, 1000)).ok).toBe(true);
    expect((await quota.take("k", 6, 10, 1, 1000)).ok).toBe(false);
    expect((await quota.salt("2026-11-05")).length).toBe(32);
  });
});
