import type { INestApplication } from "@nestjs/common";
import type { Config } from "./config/config";
import { ErrorFilter } from "./errors/error.filter";
import { setTrustProxy } from "./net/client-ip";

/**
 * The HTTP middleware main.ts serves with, shared so tests run the same
 * stack. No body parser: OTLP and event bodies are read by the controllers
 * after the key is checked, as the bytes were sent (never inflated).
 */
export const configureHttp = (
  app: INestApplication,
  config: Pick<Config, "trustProxy" | "trustProxyHops">,
): void => {
  setTrustProxy(config.trustProxy, config.trustProxyHops);

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
};
