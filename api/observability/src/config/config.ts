/**
 * Typed environment config (CueLABS standard: fail fast). Names follow
 * docs/system-design.md §10.3. Nothing else in the service reads
 * process.env.
 */

export interface Config {
  port: number;
  /** OTLP/gRPC listener (4317); 0 = off (Cloud Run serves one port: §6.3). */
  grpcPort: number;
  /** The OpenTelemetry Collector that loads ClickHouse (private). */
  collectorUrl: string;
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
  };
  /** Default per-key byte quota (S-11), overridable per key. */
  bytesPerSecond: number;
  /** Trust X-Forwarded-For's left-most public address (behind the LB). */
  trustProxy: boolean;
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
  if (missing.length) {
    throw new Error(`missing or invalid configuration: ${missing.join(", ")}`);
  }
  return {
    port: Number(env.PORT ?? 8081),
    grpcPort: Number(env.GRPC_PORT ?? 0),
    collectorUrl: collectorUrl.replace(/\/+$/, ""),
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
      host: env.REDIS_HOST ?? "",
      port: Number(env.REDIS_PORT ?? 6379),
      username: env.REDIS_USERNAME ?? "",
      password: env.REDIS_PASSWORD ?? "",
      tls: env.REDIS_TLS === "true",
      db: Number(env.REDIS_DB ?? 0),
      prefix: env.REDIS_KEY_PREFIX ?? "upstat:",
    },
    bytesPerSecond: Number(env.INGEST_BYTES_PER_SECOND ?? 2_000_000),
    trustProxy: env.TRUST_PROXY_HEADERS === "true",
    contractDir: env.CONTRACT_DIR ?? "contract",
  };
};
