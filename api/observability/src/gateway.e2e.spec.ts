import { createHash } from "node:crypto";
import {
  createServer,
  request as httpRequest,
  type ClientRequest,
  type Server,
} from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "./app.module";
import { configureHttp } from "./app.setup";
import { CONFIG, loadConfig } from "./config/config";
import {
  ConfigCacheService,
  type IngestKey,
} from "./config-cache/config-cache.service";
import { ConfigConsumerService } from "./config-cache/config-consumer.service";
import { QuotaService } from "./quota/quota.service";
import { StorageService } from "./storage/storage.service";
import { UsageService } from "./usage/usage.service";

const ORG = "11111111-1111-4111-8111-111111111111";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Received {
  path: string;
  org: string;
  encoding?: string;
  source?: string;
  body: Buffer;
}

const key = (
  id: string,
  plain: string,
  extra: Partial<IngestKey> = {},
): IngestKey => ({
  id,
  org_id: ORG,
  kind: "ingestion_token",
  scope: "otlp",
  hash: sha(plain),
  status: "active",
  allowed_origins: [],
  quotas: {},
  ...extra,
});

const keys = (revoked = false): IngestKey[] => [
  key("k-otlp", "uk_live_good"),
  key("k-rum", "uk_live_rum", { scope: "rum" }),
  key("k-gone", "uk_live_gone", { status: revoked ? "revoked" : "active" }),
  key("k-prop", "pk_live_site", {
    kind: "property_key",
    scope: "rum",
    status: "rotation_grace",
    previous_hash: sha("pk_live_old"),
    previous_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    allowed_origins: ["https://shop.example"],
  }),
];

const registry = [
  { org_id: ORG, name: "signup", dims: ["plan"], unique_ineligible: false },
  { org_id: ORG, name: "import_confirmed", dims: [], unique_ineligible: true },
];

const collector = async (
  received: Received[],
  mode: { status: number },
): Promise<{ server: Server; url: string }> => {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      received.push({
        path: req.url ?? "",
        org: String(req.headers["x-upstat-org-id"]),
        encoding: req.headers["content-encoding"] as string | undefined,
        source: req.headers["x-upstat-source"] as string | undefined,
        body: Buffer.concat(chunks),
      });
      res
        .writeHead(mode.status, { "Content-Type": "application/json" })
        .end("{}");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  return {
    server,
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
  };
};

describe("gateway", () => {
  let app: INestApplication;
  let port: number;
  let collectorServer: Server;
  const received: Received[] = [];
  const clientMode = { status: 200 };
  const snapshots = new Map<string, unknown>();
  const stubStorage = {
    prefix: "upstat/test",
    configKey: (kind: string) => kind,
    get: async (name: string) =>
      snapshots.has(name)
        ? Buffer.from(JSON.stringify(snapshots.get(name)))
        : null,
  };

  // A raw client: the body is never sent unless the test writes it.
  const raw = (
    path: string,
    headers: Record<string, string | number>,
    start: (req: ClientRequest) => void = (req) => req.flushHeaders(),
  ): Promise<{ status: number; req: ClientRequest }> =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("no response before the body")),
        3000,
      );
      const req = httpRequest(
        { host: "127.0.0.1", port, path, method: "POST", headers },
        (res) => {
          clearTimeout(timer);
          res.resume();
          resolve({ status: res.statusCode ?? 0, req });
        },
      );
      req.on("error", () => undefined);
      start(req);
    });

  beforeAll(async () => {
    const loader = await collector(received, clientMode);
    collectorServer = loader.server;
    const config = loadConfig({
      KAFKA_BROKERS: "localhost:1",
      STORAGE_DRIVER: "s3",
      STORAGE_BUCKET: "b",
      STORAGE_PREFIX: "upstat/test",
      STORAGE_ENDPOINT: "localhost:1",
      OTLP_LOADER_ENDPOINT: loader.url,
      CONTRACT_DIR: "../common/contract",
      INGEST_BYTES_PER_SECOND: "1000",
      CONFIG_MAX_AGE_SECONDS: "1",
      TRUST_PROXY_HEADERS: "true",
      INGEST_MAX_CONCURRENT_BODIES: "1",
      COLLECTOR_TIMEOUT_MS: "5000",
    });
    snapshots.set("ingest_keys", { version: 1, items: keys() });
    snapshots.set("registry", { version: 1, items: registry });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONFIG)
      .useValue(config)
      .overrideProvider(StorageService)
      .useValue(stubStorage)
      .overrideProvider(ConfigConsumerService)
      .useValue({
        running: false,
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      })
      .compile();
    app = module.createNestApplication({ bodyParser: false });
    configureHttp(app, config);
    await app.listen(0, "127.0.0.1");
    port = (app.getHttpServer().address() as AddressInfo).port;
    await app.get(ConfigCacheService).load();
  });

  afterAll(async () => {
    await app.close();
    collectorServer.close();
  });

  beforeEach(() => {
    received.length = 0;
    clientMode.status = 200;
  });
  afterEach(() => jest.restoreAllMocks());

  it("is ready without Kafka", async () => {
    await request(app.getHttpServer()).get("/ready").expect(200);
  });

  it("forwards OTLP unparsed with the org header and no source header", async () => {
    const payload = Buffer.from([0x0a, 0x02, 0x08, 0x01]);
    await request(app.getHttpServer())
      .post("/v1/traces")
      .set("Upstat-Ingest-Key", "uk_live_good")
      .set("Content-Type", "application/x-protobuf")
      .send(payload)
      .expect(200);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ path: "/v1/traces", org: ORG });
    expect(received[0].source).toBeUndefined();
    expect(received[0].body.equals(payload)).toBe(true);
  });

  it("never passes a customer-supplied X-Upstat-Source to the collector", async () => {
    await request(app.getHttpServer())
      .post("/v1/logs")
      .set("Upstat-Ingest-Key", "uk_live_good")
      .set("Content-Type", "application/json")
      .set("X-Upstat-Source", "internal")
      .send("{}")
      .expect(200);
    expect(received).toHaveLength(1);
    expect(received[0].source).toBeUndefined();
  });

  it("passes gzip bytes and Content-Encoding through exactly as received", async () => {
    const gz = gzipSync(Buffer.from("not really protobuf".repeat(20)));
    await request(app.getHttpServer())
      .post("/v1/logs")
      .set("Upstat-Ingest-Key", "uk_live_good")
      .set("Content-Type", "application/x-protobuf")
      .set("Content-Encoding", "gzip")
      .send(gz)
      .expect(200);
    expect(received[0].encoding).toBe("gzip");
    expect(received[0].body.equals(gz)).toBe(true);
  });

  it("refuses unknown keys, wrong scopes and an over-quota key", async () => {
    const server = app.getHttpServer();
    await request(server)
      .post("/v1/logs")
      .set("Content-Type", "application/json")
      .send("{}")
      .expect(401);
    await request(server)
      .post("/v1/logs")
      .set("Upstat-Ingest-Key", "uk_live_rum")
      .set("Content-Type", "application/json")
      .send("{}")
      .expect(403);
    const big = Buffer.alloc(1500, 1);
    const res = await request(server)
      .post("/v1/metrics")
      .set("Authorization", "Bearer uk_live_good")
      .set("Content-Type", "application/x-protobuf")
      .send(big);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("quota_exceeded");
    expect(res.headers["retry-after"]).toBeDefined();
    expect(received).toHaveLength(0);
  });

  describe("before the body is read", () => {
    const declared = { "Content-Length": 5_000_000 };

    it("refuses a missing key without waiting for the body", async () => {
      const { status, req } = await raw("/v1/traces", {
        "Content-Type": "application/x-protobuf",
        ...declared,
      });
      req.destroy();
      expect(status).toBe(401);
    });

    it("refuses an unknown key without waiting for the body", async () => {
      const { status, req } = await raw("/v1/traces", {
        "Content-Type": "application/x-protobuf",
        "Upstat-Ingest-Key": "uk_live_nope",
        ...declared,
      });
      req.destroy();
      expect(status).toBe(401);
    });

    it("refuses the wrong content type without waiting for the body", async () => {
      const { status, req } = await raw("/v1/traces", {
        "Content-Type": "text/plain",
        "Upstat-Ingest-Key": "uk_live_good",
        ...declared,
      });
      req.destroy();
      expect(status).toBe(415);
    });

    it("refuses a declared size over the cap without waiting for the body", async () => {
      const { status, req } = await raw("/v1/traces", {
        "Content-Type": "application/x-protobuf",
        "Upstat-Ingest-Key": "uk_live_good",
        "Content-Length": 64 << 20,
      });
      req.destroy();
      expect(status).toBe(413);
    });

    it("refuses an event batch with a bad origin or content type unread", async () => {
      const bad = await raw("/v1/events", {
        "Content-Type": "application/json",
        Authorization: "Bearer pk_live_site",
        Origin: "https://evil.example",
        "Content-Length": 100_000,
      });
      bad.req.destroy();
      expect(bad.status).toBe(403);
      const type = await raw("/v1/events", {
        "Content-Type": "text/plain",
        Authorization: "Bearer pk_live_site",
        "Content-Length": 100_000,
      });
      type.req.destroy();
      expect(type.status).toBe(415);
    });

    it("caps how many large bodies are read at once", async () => {
      const headers = {
        "Content-Type": "application/x-protobuf",
        "Upstat-Ingest-Key": "uk_live_good",
        "Content-Length": 100_000,
      };
      const first = httpRequest({
        host: "127.0.0.1",
        port,
        path: "/v1/traces",
        method: "POST",
        headers,
      });
      first.on("error", () => undefined);
      first.write(Buffer.alloc(10));
      await sleep(250);
      const second = await raw("/v1/traces", headers);
      second.req.destroy();
      first.destroy();
      expect(second.status).toBe(503);
    });
  });

  it("answers a retryable status while the collector fails", async () => {
    clientMode.status = 500;
    const res = await request(app.getHttpServer())
      .post("/v1/logs")
      .set("Upstat-Ingest-Key", "uk_live_good")
      .set("Content-Type", "application/json")
      .send("{}");
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("unavailable");
    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("reads the client address from the trusted hop, never the left", async () => {
    const take = jest.spyOn(app.get(QuotaService), "take");
    await request(app.getHttpServer())
      .post("/v1/logs")
      .set("Upstat-Ingest-Key", "uk_live_good")
      .set("Content-Type", "application/json")
      .set("X-Forwarded-For", "6.6.6.6, 203.0.113.7")
      .send("{}")
      .expect(200);
    expect(take.mock.calls[0][0]).toBe(QuotaService.ipKey("203.0.113.7"));
  });

  it("accepts events with per-item rejections and hashes browser visitors", async () => {
    const now = new Date().toISOString();
    const res = await request(app.getHttpServer())
      .post("/v1/events")
      .set("Authorization", "Bearer pk_live_site")
      .set("Origin", "https://shop.example")
      .set("User-Agent", "Mozilla/5.0")
      .send({
        events: [
          {
            name: "page_view",
            ts: now,
            dims: { path: "/pricing", device_class: "mobile", country: "NG" },
          },
          { name: "signup", dims: { plan: "pro" } },
          { name: "mystery" },
          { name: "page_view", dims: { email: "a@b.c" } },
          { name: "page_view", ts: "2020-01-01T00:00:00Z" },
          "nope",
        ],
      })
      .expect(202);
    expect(res.body).toEqual({
      accepted: 2,
      rejected: 4,
      rejections: [
        { index: 2, code: "unknown_event" },
        { index: 3, code: "unknown_dim" },
        { index: 4, code: "ts_out_of_range" },
        { index: 5, code: "bad_shape" },
      ],
    });
    expect(received).toHaveLength(1);
    expect(received[0].source).toBe("internal");
    const body = JSON.parse(received[0].body.toString());
    const records = body.resourceLogs[0].scopeLogs[0].logRecords;
    const attrs = (r: {
      attributes: { key: string; value: { stringValue: string } }[];
    }) =>
      Object.fromEntries(r.attributes.map((a) => [a.key, a.value.stringValue]));
    expect(attrs(records[0])).toMatchObject({
      "upstat.kind": "event",
      name: "page_view",
      path: "/pricing",
      property_id: "k-prop",
    });
    expect(attrs(records[0]).visitor_hash).toMatch(/^[0-9a-f]{32}$/);
    expect(attrs(records[1])["dim.plan"]).toBe("pro");
    // The raw IP and user agent never leave the gateway.
    expect(received[0].body.toString()).not.toMatch(/Mozilla|127\.0\.0\.1|::1/);
  });

  it("enforces the origin allowlist and keeps the old key for its grace", async () => {
    await request(app.getHttpServer())
      .post("/v1/events")
      .set("Authorization", "Bearer pk_live_site")
      .set("Origin", "https://evil.example")
      .send({ events: [{ name: "page_view" }] })
      .expect(403);
    await request(app.getHttpServer())
      .post("/v1/events")
      .set("Authorization", "Bearer pk_live_old")
      .send({ events: [{ name: "import_confirmed" }] })
      .expect(202);
    const attrs = JSON.parse(
      received[0].body.toString(),
    ).resourceLogs[0].scopeLogs[0].logRecords[0].attributes.map(
      (a: { key: string }) => a.key,
    );
    expect(attrs).not.toContain("visitor_hash"); // a server event has no visitor
  });

  it("treats Origin null as an origin no allowlist names", async () => {
    const res = await request(app.getHttpServer())
      .post("/v1/events")
      .set("Authorization", "Bearer pk_live_site")
      .set("Origin", "null")
      .send({ events: [{ name: "page_view" }] });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("origin_not_allowed");
    expect(received).toHaveLength(0);
  });

  it("meters the bytes of a chunked event body", async () => {
    const add = jest.spyOn(app.get(UsageService), "add");
    const payload = JSON.stringify({ events: [{ name: "page_view" }] });
    const { status, req } = await raw(
      "/v1/events",
      {
        "Content-Type": "application/json",
        Authorization: "Bearer pk_live_site",
        Origin: "https://shop.example",
      },
      (r) => {
        r.write(payload.slice(0, 10));
        r.write(payload.slice(10));
        r.end();
      },
    );
    req.destroy();
    expect(status).toBe(202);
    expect(add).toHaveBeenCalledWith(
      ORG,
      "k-prop",
      "rum",
      Buffer.byteLength(payload),
      1,
      expect.any(Number),
    );
  });

  it("rejects malformed batches as a whole", async () => {
    await request(app.getHttpServer())
      .post("/v1/events")
      .set("Authorization", "Bearer pk_live_site")
      .send({ events: [] })
      .expect(400);
  });

  it("stops serving a revoked key on a warm instance within the max age", async () => {
    const send = () =>
      request(app.getHttpServer())
        .post("/v1/logs")
        .set("Upstat-Ingest-Key", "uk_live_gone")
        .set("Content-Type", "application/json")
        .send("{}");
    await send().expect(200);
    snapshots.set("ingest_keys", { version: 2, items: keys(true) });
    await sleep(1200);
    await send().expect(401);
  });
});
