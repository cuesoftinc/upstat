/**
 * Typed environment config (CueLABS standard: fail fast). Names follow
 * docs/system-design.md §10.3. Nothing else in the service reads
 * process.env.
 */

/** http = Express on PORT; grpc = OTLP/gRPC (h2c) on PORT; both = Express on PORT plus gRPC on GRPC_PORT. */
export type Transport = "http" | "grpc" | "both";

export interface Config {
  port: number;
  /** Second listener for transport "both" (compose, self-host). */
  grpcPort: number;
  /** Cloud Run routes only PORT, so each ingest service serves one transport (§6.3). */
  transport: Transport;
  /** The OpenTelemetry Collector that loads ClickHouse (private). */
  collectorUrl: string;
  /** Must exceed the collector's retry budget (otel-collector.yaml: 8 s + 4 s). */
  collectorTimeoutMs: number;
  kafka: {
    brokers: string[];
    username: string;
    password: string;
    sslCa: string;
  };
  storage: {
    driver: "gcs" | "s3";
    bucket: string;
    /** e.g. upstat/stg — every key starts with it. */
    prefix: string;
    endpoint: string;
    accessKey: string;
    secretKey: string;
    useSsl: boolean;
  };
  redis: {
    host: string;
    port: number;
    username: string;
    password: string;
    tls: boolean;
    db: number;
    prefix: string;
    /** true = Valkey outages answer 503; false = single-process local state (dev only). */
    required: boolean;
  };
  /** Default per-key byte quota (S-11), overridable per key. */
  bytesPerSecond: number;
  /** How long a cache hit stays unchecked against common's snapshot. */
  configMaxAgeMs: number;
  /** Largest OTLP body accepted, in bytes as received (compressed). */
  maxBodyBytes: number;
  /** Bodies over 64 KiB read at once per instance; more get 503. */
  maxConcurrentBodies: number;
  /** Read the client address from X-Forwarded-For (on by default on Cloud Run). */
  trustProxy: boolean;
  /** Proxies that append to X-Forwarded-For; the client is that far from the right. */
  trustProxyHops: number;
  contractDir: string;
}

export const CONFIG = Symbol("CONFIG");

const required = (
  env: NodeJS.ProcessEnv,
  name: string,
  missing: string[],
): string => {
  const value = env[name]?.trim() ?? "";
  if (!value) missing.push(name);
  return value;
};

const list = (raw: string): string[] =>
  raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

const positive = (
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  missing: string[],
): number => {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1)
    missing.push(`${name} (integer >= 1)`);
  return value;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const missing: string[] = [];
  const brokers = required(env, "KAFKA_BROKERS", missing);
  const bucket = required(env, "STORAGE_BUCKET", missing);
  const prefix = required(env, "STORAGE_PREFIX", missing);
  const collectorUrl = required(env, "OTLP_LOADER_ENDPOINT", missing);
  const driver = (
    env.STORAGE_DRIVER ?? "gcs"
  ).trim() as Config["storage"]["driver"];
  if (driver !== "gcs" && driver !== "s3")
    missing.push("STORAGE_DRIVER (gcs|s3)");
  if (driver === "s3") required(env, "STORAGE_ENDPOINT", missing);
  const grpcPort = Number(env.GRPC_PORT ?? 0);
  const transport = (
    env.INGEST_TRANSPORT?.trim() || (grpcPort > 0 ? "both" : "http")
  ).toLowerCase() as Transport;
  if (!["http", "grpc", "both"].includes(transport))
    missing.push("INGEST_TRANSPORT (http|grpc|both)");
  if (transport === "both" && !(grpcPort > 0))
    missing.push("GRPC_PORT (transport both)");
  const cloud = Boolean(env.K_SERVICE);
  const redisHost = env.REDIS_HOST ?? "";
  const redisRequired = env.REDIS_REQUIRED
    ? env.REDIS_REQUIRED === "true"
    : cloud || Boolean(redisHost);
  if (redisRequired && !redisHost) missing.push("REDIS_HOST");
  const configMaxAgeMs =
    positive(env, "CONFIG_MAX_AGE_SECONDS", 30, missing) * 1000;
  const maxBodyBytes = positive(
    env,
    "INGEST_MAX_BODY_BYTES",
    16 << 20,
    missing,
  );
  const maxConcurrentBodies = positive(
    env,
    "INGEST_MAX_CONCURRENT_BODIES",
    8,
    missing,
  );
  const trustProxyHops = positive(env, "TRUST_PROXY_HOPS", 1, missing);
  const collectorTimeoutMs = positive(
    env,
    "COLLECTOR_TIMEOUT_MS",
    15_000,
    missing,
  );
  if (missing.length) {
    throw new Error(`missing or invalid configuration: ${missing.join(", ")}`);
  }
  return {
    port: Number(env.PORT ?? 8081),
    grpcPort,
    transport,
    collectorUrl: collectorUrl.replace(/\/+$/, ""),
    collectorTimeoutMs,
    kafka: {
      brokers: list(brokers),
      username: env.KAFKA_USERNAME ?? "",
      password: env.KAFKA_PASSWORD ?? "",
      sslCa: env.KAFKA_SSL_CA ?? "",
    },
    storage: {
      driver,
      bucket,
      prefix: prefix.replace(/\/+$/, ""),
      endpoint: env.STORAGE_ENDPOINT ?? "",
      accessKey: env.STORAGE_ACCESS_KEY ?? "",
      secretKey: env.STORAGE_SECRET_KEY ?? "",
      useSsl: (env.STORAGE_USE_SSL ?? "true") !== "false",
    },
    redis: {
      host: redisHost,
      port: Number(env.REDIS_PORT ?? 6379),
      username: env.REDIS_USERNAME ?? "",
      password: env.REDIS_PASSWORD ?? "",
      tls: env.REDIS_TLS === "true",
      db: Number(env.REDIS_DB ?? 0),
      prefix: env.REDIS_KEY_PREFIX ?? "upstat:",
      required: redisRequired,
    },
    bytesPerSecond: Number(env.INGEST_BYTES_PER_SECOND ?? 2_000_000),
    configMaxAgeMs,
    maxBodyBytes,
    maxConcurrentBodies,
    trustProxy: env.TRUST_PROXY_HEADERS
      ? env.TRUST_PROXY_HEADERS === "true"
      : cloud,
    trustProxyHops,
    contractDir: env.CONTRACT_DIR ?? "contract",
  };
};
