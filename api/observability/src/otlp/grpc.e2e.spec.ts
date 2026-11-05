import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import * as grpc from "@grpc/grpc-js";
import type { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { createHash } from "node:crypto";
import { AppModule } from "../app.module";
import { CONFIG, loadConfig } from "../config/config";
import { ConfigCacheService } from "../config-cache/config-cache.service";
import { ConfigConsumerService } from "../config-cache/config-consumer.service";
import { StorageService } from "../storage/storage.service";

const LOGS = "/opentelemetry.proto.collector.logs.v1.LogsService/Export";
const identity = (b: Buffer) => b;

const freePort = (): Promise<number> =>
  new Promise((resolve) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });

describe("OTLP/gRPC transport", () => {
  let module: TestingModule;
  let client: grpc.Client;
  let collector: Server;
  const received: { path: string; org: string; body: Buffer }[] = [];
  const mode = { status: 200 };

  const call = (key?: string) =>
    new Promise<grpc.ServiceError | null>((resolve) => {
      const md = new grpc.Metadata();
      if (key) md.set("upstat-ingest-key", key);
      client.makeUnaryRequest(
        LOGS,
        identity,
        identity,
        Buffer.from([1, 2, 3]),
        md,
        (error) => resolve(error),
      );
    });

  // The snapshot storage serves, as in production; a key-miss reread returns it.
  const goodKey = {
    id: "k-otlp",
    org_id: "org-1",
    kind: "ingestion_token",
    scope: "otlp",
    hash: createHash("sha256").update("uk_live_good").digest("hex"),
    status: "active",
    allowed_origins: [],
    quotas: {},
  };

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
        res.writeHead(mode.status).end("{}");
      });
    });
    await new Promise<void>((r) => collector.listen(0, "127.0.0.1", r));
    const url = `http://127.0.0.1:${(collector.address() as AddressInfo).port}`;
    const port = await freePort();
    const config = loadConfig({
      KAFKA_BROKERS: "localhost:1",
      STORAGE_DRIVER: "s3",
      STORAGE_BUCKET: "b",
      STORAGE_PREFIX: "upstat/test",
      STORAGE_ENDPOINT: "localhost:1",
      OTLP_LOADER_ENDPOINT: url,
      CONTRACT_DIR: "../common/contract",
      INGEST_TRANSPORT: "grpc",
      PORT: String(port),
    });
    module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONFIG)
      .useValue(config)
      .overrideProvider(StorageService)
      .useValue({
        prefix: "p",
        configKey: (k: string) => k,
        get: async (key: string) =>
          key === "ingest_keys"
            ? Buffer.from(JSON.stringify({ version: 1, items: [goodKey] }))
            : null,
      })
      .overrideProvider(ConfigConsumerService)
      .useValue({
        running: false,
        onModuleInit: async () => undefined,
        onModuleDestroy: async () => undefined,
      })
      .compile();
    await module.init();
    await module.get(ConfigCacheService).load();
    client = new grpc.Client(
      `127.0.0.1:${port}`,
      grpc.credentials.createInsecure(),
    );
  });

  afterAll(async () => {
    client.close();
    await module.close();
    collector.close();
  });

  beforeEach(() => {
    received.length = 0;
    mode.status = 200;
  });

  it("serves gRPC on PORT and forwards the raw message", async () => {
    expect(await call("uk_live_good")).toBeNull();
    expect(received).toHaveLength(1);
    expect(received[0]).toMatchObject({ path: "/v1/logs", org: "org-1" });
    expect(received[0].body.equals(Buffer.from([1, 2, 3]))).toBe(true);
  });

  it("refuses a missing or unknown key before the handler runs", async () => {
    expect((await call())?.code).toBe(grpc.status.UNAUTHENTICATED);
    expect((await call("uk_live_nope"))?.code).toBe(
      grpc.status.UNAUTHENTICATED,
    );
    expect(received).toHaveLength(0);
  });

  it("answers UNAVAILABLE while the collector fails", async () => {
    mode.status = 500;
    expect((await call("uk_live_good"))?.code).toBe(grpc.status.UNAVAILABLE);
  });
});
