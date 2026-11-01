import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import express from "express";
import request from "supertest";
import { AppModule } from "./app.module";
import { CONFIG, loadConfig } from "./config/config";
import { ConfigCacheService } from "./config-cache/config-cache.service";
import { ConfigConsumerService } from "./config-cache/config-consumer.service";
import { ErrorFilter } from "./errors/error.filter";

const ORG = "11111111-1111-4111-8111-111111111111";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

interface Received {
  path: string;
  org: string;
  body: Buffer;
}

describe("gateway", () => {
  let app: INestApplication;
  let collector: Server;
  const received: Received[] = [];

  beforeAll(async () => {
    collector = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        received.push({
          path: req.url ?? "",
          org: String(req.headers["x-upstat-org-id"]),
          body: Buffer.concat(chunks),
        });
        res.writeHead(200, { "Content-Type": "application/json" }).end("{}");
      });
    });
    await new Promise<void>((r) => collector.listen(0, "127.0.0.1", r));
    const port = (collector.address() as AddressInfo).port;
    const config = {
      ...loadConfig({
        KAFKA_BROKERS: "localhost:1",
        STORAGE_DRIVER: "s3",
        STORAGE_BUCKET: "b",
        STORAGE_PREFIX: "upstat/test",
        STORAGE_ENDPOINT: "localhost:1",
        OTLP_LOADER_ENDPOINT: `http://127.0.0.1:${port}`,
        CONTRACT_DIR: "../common/contract",
        INGEST_BYTES_PER_SECOND: "1000",
      }),
    };
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONFIG)
      .useValue(config)
      .overrideProvider(ConfigConsumerService)
      .useValue({
        running: true,
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      })
      .compile();
    app = module.createNestApplication({ bodyParser: false });
    app.use(
      ["/v1/traces", "/v1/metrics", "/v1/logs"],
      express.raw({ type: () => true, limit: "16mb" }),
    );
    app.use("/v1/events", express.json());
    app.useGlobalFilters(new ErrorFilter());
    await app.init();
    app.get(ConfigCacheService).set(
      [
        {
          id: "k-otlp",
          org_id: ORG,
          kind: "ingestion_token",
          scope: "otlp",
          hash: sha("uk_live_good"),
          status: "active",
          allowed_origins: [],
          quotas: {},
        },
        {
          id: "k-rum",
          org_id: ORG,
          kind: "ingestion_token",
          scope: "rum",
          hash: sha("uk_live_rum"),
          status: "active",
          allowed_origins: [],
          quotas: {},
        },
        {
          id: "k-prop",
          org_id: ORG,
          kind: "property_key",
          scope: "rum",
          hash: sha("pk_live_site"),
          status: "rotation_grace",
          previous_hash: sha("pk_live_old"),
          previous_expires_at: new Date(Date.now() + 3600_000).toISOString(),
          allowed_origins: ["https://shop.example"],
          quotas: {},
        },
      ],
      [
        {
          org_id: ORG,
          name: "signup",
          dims: ["plan"],
          unique_ineligible: false,
        },
        {
          org_id: ORG,
          name: "import_confirmed",
          dims: [],
          unique_ineligible: true,
        },
      ],
    );
  });

  afterAll(async () => {
    await app.close();
    collector.close();
  });

  beforeEach(() => (received.length = 0));

  it("forwards OTLP unparsed with the org header", async () => {
    const payload = Buffer.from([0x0a, 0x02, 0x08, 0x01]);
    await request(app.getHttpServer())
      .post("/v1/traces")
      .set("Upstat-Ingest-Key", "uk_live_good")
      .set("Content-Type", "application/x-protobuf")
      .send(payload)
      .expect(200);
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ path: "/v1/traces", org: ORG });
    expect(received[0].body.equals(payload)).toBe(true);
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

  it("rejects malformed batches as a whole", async () => {
    await request(app.getHttpServer())
      .post("/v1/events")
      .set("Authorization", "Bearer pk_live_site")
      .send({ events: [] })
      .expect(400);
  });
});
