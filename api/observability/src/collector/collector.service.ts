import { Inject, Injectable } from "@nestjs/common";
import { CONFIG, type Config } from "../config/config";

export interface Forwarded {
  status: number;
  body: Buffer;
  contentType: string;
}

/** One OTLP log attribute. */
const kv = (key: string, value: string) => ({
  key,
  value: { stringValue: value },
});

/**
 * The hop to the OpenTelemetry Collector (§6.3 as amended by X-11): OTLP
 * passes through unparsed with the org in X-Upstat-Org-Id, which the
 * collector stamps on the resource; product events and usage go as OTLP
 * logs that ClickHouse views split into their own tables.
 */
@Injectable()
export class CollectorService {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  async forward(
    signal: "traces" | "metrics" | "logs",
    body: Buffer,
    orgId: string,
    contentType: string,
    contentEncoding?: string,
  ): Promise<Forwarded> {
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "X-Upstat-Org-Id": orgId,
    };
    if (contentEncoding) headers["Content-Encoding"] = contentEncoding;
    const response = await fetch(`${this.config.collectorUrl}/v1/${signal}`, {
      method: "POST",
      headers,
      body: new Uint8Array(body),
      signal: AbortSignal.timeout(10_000),
    });
    return {
      status: response.status,
      body: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") ?? contentType,
    };
  }

  /** Upstat's own rows as OTLP/JSON logs under service.name `service`. */
  async logs(
    orgId: string,
    service: string,
    records: { time: number; attributes: Record<string, string> }[],
  ): Promise<void> {
    if (!records.length) return;
    const body = {
      resourceLogs: [
        {
          resource: { attributes: [kv("service.name", service)] },
          scopeLogs: [
            {
              scope: { name: "upstat.gateway" },
              logRecords: records.map((r) => ({
                timeUnixNano: String(BigInt(Math.round(r.time)) * 1_000_000n),
                severityText: "INFO",
                body: { stringValue: service },
                attributes: Object.entries(r.attributes).map(([k, v]) =>
                  kv(k, v),
                ),
              })),
            },
          ],
        },
      ],
    };
    const response = await this.forward(
      "logs",
      Buffer.from(JSON.stringify(body)),
      orgId,
      "application/json",
    );
    if (response.status >= 300)
      throw new Error(`collector answered ${response.status}`);
  }
}
