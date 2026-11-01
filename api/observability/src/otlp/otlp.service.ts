import { Inject, Injectable, Logger } from "@nestjs/common";
import { CONFIG, type Config } from "../config/config";
import {
  CollectorService,
  type Forwarded,
} from "../collector/collector.service";
import { ConfigCacheService } from "../config-cache/config-cache.service";
import { ApiError } from "../errors/api-error";
import { QuotaService } from "../quota/quota.service";
import { UsageService } from "../usage/usage.service";

export type Signal = "traces" | "metrics" | "logs";

/** Pre-auth flood guard per source address (engineering.md §3). */
export const PREAUTH_PER_MINUTE = 1000;

/**
 * OTLP ingest (OBS-001, §6.3): authenticate the ingest key, meter its
 * bytes, forward the payload unparsed. HTTP and gRPC share this path.
 */
@Injectable()
export class OtlpService {
  private readonly logger = new Logger(OtlpService.name);

  constructor(
    @Inject(CONFIG) private readonly config: Config,
    private readonly cache: ConfigCacheService,
    private readonly quota: QuotaService,
    private readonly collector: CollectorService,
    private readonly usage: UsageService,
  ) {}

  async ingest(
    signal: Signal,
    body: Buffer,
    plainKey: string,
    contentType: string,
    contentEncoding: string | undefined,
    ip: string,
  ): Promise<Forwarded> {
    const pre = await this.quota.take(
      QuotaService.ipKey(ip),
      1,
      PREAUTH_PER_MINUTE,
      60,
    );
    if (!pre.ok)
      throw new ApiError(429, "rate_limited", "Too many requests", {
        retry_after: pre.retryAfter,
      });
    if (!plainKey)
      throw new ApiError(
        401,
        "unauthorized",
        "Send your ingestion token in Upstat-Ingest-Key",
      );
    const key = await this.cache.lookupFresh(plainKey, "ingestion_token", [
      "otlp",
    ]);
    if (key === "scope")
      throw new ApiError(
        403,
        "key_scope_mismatch",
        "This key is not scoped for OTLP",
      );
    if (key === null)
      throw new ApiError(
        401,
        "unauthorized",
        "Unknown or revoked ingestion token",
      );
    const limit = key.quotas?.bytes_per_second ?? this.config.bytesPerSecond;
    const verdict = await this.quota.take(
      `key:${key.id}`,
      body.length,
      limit,
      1,
    );
    if (!verdict.ok) {
      throw new ApiError(
        429,
        "quota_exceeded",
        "This key is over its byte quota",
        { retry_after: verdict.retryAfter },
      );
    }
    let forwarded: Forwarded;
    try {
      forwarded = await this.collector.forward(
        signal,
        body,
        key.org_id,
        contentType,
        contentEncoding,
      );
    } catch (error) {
      this.logger.error({
        message: "collector unreachable",
        signal,
        error: (error as Error).message,
      });
      throw new ApiError(
        503,
        "unavailable",
        "Ingest is temporarily unavailable; retry",
        { retry_after: 5 },
      );
    }
    if (forwarded.status < 300)
      this.usage.add(key.org_id, key.id, signal, body.length);
    return forwarded;
  }
}
