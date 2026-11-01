import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import express from "express";
import { AppModule } from "./app.module";
import { CONFIG, type Config } from "./config/config";
import { ErrorFilter } from "./errors/error.filter";
import { setTrustProxy } from "./net/client-ip";
import { JsonLogger } from "./telemetry/json-logger";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new JsonLogger(),
    bodyParser: false,
  });
  const config = app.get<Config>(CONFIG);
  setTrustProxy(config.trustProxy);

  // OTLP bodies stay raw bytes (never parsed, §6.3); events are JSON.
  app.use(
    ["/v1/traces", "/v1/metrics", "/v1/logs"],
    express.raw({ type: () => true, limit: "16mb" }),
  );
  app.use("/v1/events", express.json({ limit: "256kb" }));

  // Browser beacons come from customers' sites: any origin may call, and
  // each property key's allowlist is enforced on the request itself
  // (403 origin_not_allowed). No cookies ever.
  app.enableCors({
    origin: true,
    credentials: false,
    methods: ["POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Content-Encoding",
      "Authorization",
      "Upstat-Ingest-Key",
    ],
    maxAge: 600,
  });
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();

  await app.listen(config.port);
}

bootstrap();
