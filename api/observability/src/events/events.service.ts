import { createHash } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { CollectorService } from "../collector/collector.service";
import {
  ConfigCacheService,
  type IngestKey,
} from "../config-cache/config-cache.service";
import { ApiError, unavailable } from "../errors/api-error";
import { QuotaService } from "../quota/quota.service";
import { UsageService } from "../usage/usage.service";

/** The closed browser vocabulary every event admits (api.md §3.1). */
const BROWSER_DIMS = new Set([
  "path",
  "referrer_host",
  "device_class",
  "country",
]);
/**
 * Events the browser SDK sends without registration (upstat.js: page
 * views, web vitals, JS errors), with the extra dims each carries.
 */
const BUILT_IN: Record<string, string[]> = {
  page_view: [],
  web_vital: ["metric"],
  js_error: ["fingerprint", "message"],
};
const DEVICE = new Set(["mobile", "desktop", "tablet"]);
const MAX_BATCH = 100;
const PAST_MS = 48 * 3600 * 1000;
const FUTURE_MS = 5 * 60 * 1000;
/** Per property key: 600/min sustained, 1,200 burst (analytics-math.md §6). */
const EVENTS_PER_MINUTE = 1200;

export interface Rejection {
  index: number;
  code: "unknown_event" | "unknown_dim" | "ts_out_of_range" | "bad_shape";
}

export interface Accepted {
  accepted: number;
  rejected: number;
  rejections: Rejection[];
}

export interface Context {
  plainKey: string;
  origin?: string;
  ip: string;
  userAgent: string;
}

/**
 * POST /v1/events (§6.4, api.md §3): property-key auth and the origin
 * allowlist, registry-as-schema validation, then visitor_hash with the
 * day's salt. The IP and user agent are used for the hash and dropped
 * here: they never leave this function (D7, analytics-math.md §1).
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly cache: ConfigCacheService,
    private readonly quota: QuotaService,
    private readonly collector: CollectorService,
    private readonly usage: UsageService,
  ) {}

  /**
   * Everything decided before the body is read: the source limit, the
   * property key and its origin allowlist.
   */
  async authenticate(
    ctx: Pick<Context, "plainKey" | "origin" | "ip">,
    now = Date.now(),
  ): Promise<IngestKey> {
    const pre = await this.quota.take(
      QuotaService.ipKey(ctx.ip),
      1,
      1000,
      60,
      now,
    );
    if (!pre.ok)
      throw new ApiError(429, "rate_limited", "Too many requests", {
        retry_after: pre.retryAfter,
      });
    return this.authorize(ctx);
  }

  private async authorize(
    ctx: Pick<Context, "plainKey" | "origin">,
  ): Promise<IngestKey> {
    if (!ctx.plainKey)
      throw new ApiError(
        401,
        "unauthorized",
        "Send your property key as a Bearer token",
      );
    const key = await this.cache.lookupFresh(ctx.plainKey, "property_key", [
      "rum",
    ]);
    if (key === "scope")
      throw new ApiError(
        403,
        "key_scope_mismatch",
        "This key is not scoped for events",
      );
    if (key === null)
      throw new ApiError(
        401,
        "unauthorized",
        "Unknown or revoked property key",
      );
    // An opaque origin ("null": sandboxed frames, file:, redirects) names no site.
    if (
      ctx.origin !== undefined &&
      (ctx.origin === "null" ||
        !(key.allowed_origins ?? []).includes(ctx.origin))
    ) {
      throw new ApiError(
        403,
        "origin_not_allowed",
        "This origin is not on the property's allowlist",
      );
    }
    return key;
  }

  /** The batch of an authenticated request; `rawBytes` is the body as received. */
  async accept(
    key: IngestKey,
    body: unknown,
    rawBytes: number,
    ctx: Context,
    now = Date.now(),
  ): Promise<Accepted> {
    await this.cache.ensureFresh("registry", now);
    const events = (body as { events?: unknown })?.events;
    if (
      !Array.isArray(events) ||
      events.length === 0 ||
      events.length > MAX_BATCH
    ) {
      throw new ApiError(
        400,
        "bad_shape",
        `events is an array of 1-${MAX_BATCH}`,
      );
    }
    const rate = await this.quota.take(
      `events:${key.id}`,
      events.length,
      EVENTS_PER_MINUTE,
      60,
      now,
    );
    if (!rate.ok)
      throw new ApiError(
        429,
        "rate_limited",
        "This property is over its event rate",
        { retry_after: rate.retryAfter },
      );

    const rejections: Rejection[] = [];
    const records: { time: number; attributes: Record<string, string> }[] = [];
    const browser = Boolean(ctx.origin);
    for (const [index, raw] of events.entries()) {
      const verdict = this.validate(key.org_id, raw, now);
      if ("code" in verdict) {
        rejections.push({ index, code: verdict.code });
        continue;
      }
      const { name, ts, dims, value, ineligible } = verdict;
      const attributes: Record<string, string> = {
        "upstat.kind": "event",
        property_id: key.id,
        name,
        value: String(value ?? 0),
      };
      for (const [k, v] of Object.entries(dims)) {
        attributes[BROWSER_DIMS.has(k) ? k : `dim.${k}`] = v;
      }
      // Server-emitted events carry the server's address: no visitor
      // (analytics-math.md §4a).
      if (browser && !ineligible) {
        const day = new Date(ts).toISOString().slice(0, 10);
        const salt = await this.quota.salt(day, now);
        attributes.visitor_hash = createHash("sha256")
          .update(
            Buffer.concat([
              salt,
              Buffer.from(`${key.id}${ctx.ip}${ctx.userAgent}`),
            ]),
          )
          .digest("hex")
          .slice(0, 32);
      }
      records.push({ time: ts, attributes });
    }
    if (records.length) {
      try {
        await this.collector.logs(key.org_id, "upstat.events", records);
      } catch (error) {
        this.logger.error({
          message: "events not forwarded",
          error: (error as Error).message,
        });
        throw unavailable();
      }
      try {
        await this.usage.add(
          key.org_id,
          key.id,
          "rum",
          rawBytes,
          records.length,
          now,
        );
      } catch (error) {
        this.logger.error({
          message: "usage not recorded",
          error: (error as Error).message,
        });
      }
      await this.usage.flushDue(now);
    }
    if (rejections.length) {
      this.logger.log({
        message: "events rejected",
        property_id: key.id,
        rejected: rejections.length,
      });
    }
    return {
      accepted: records.length,
      rejected: rejections.length,
      rejections,
    };
  }

  private validate(
    orgId: string,
    raw: unknown,
    now: number,
  ):
    | { code: Rejection["code"] }
    | {
        name: string;
        ts: number;
        dims: Record<string, string>;
        value?: number;
        ineligible: boolean;
      } {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
      return { code: "bad_shape" };
    const event = raw as {
      name?: unknown;
      ts?: unknown;
      dims?: unknown;
      value?: unknown;
    };
    if (typeof event.name !== "string" || !event.name)
      return { code: "bad_shape" };
    const registered = this.cache.event(orgId, event.name);
    const builtIn = BUILT_IN[event.name];
    if (!registered && !builtIn) return { code: "unknown_event" };
    const allowed = new Set([
      ...BROWSER_DIMS,
      ...(registered?.dims ?? []),
      ...(builtIn ?? []),
    ]);
    let ts = now;
    if (event.ts !== undefined) {
      ts = typeof event.ts === "string" ? Date.parse(event.ts) : NaN;
      if (Number.isNaN(ts)) return { code: "bad_shape" };
    }
    if (ts < now - PAST_MS || ts > now + FUTURE_MS)
      return { code: "ts_out_of_range" };
    const dims: Record<string, string> = {};
    if (event.dims !== undefined) {
      if (
        typeof event.dims !== "object" ||
        event.dims === null ||
        Array.isArray(event.dims)
      )
        return { code: "bad_shape" };
      for (const [k, v] of Object.entries(event.dims)) {
        if (!allowed.has(k)) return { code: "unknown_dim" };
        if (typeof v !== "string" || v.length > 512)
          return { code: "bad_shape" };
        if (k === "device_class" && !DEVICE.has(v))
          return { code: "bad_shape" };
        if (k === "country" && !/^[A-Z]{2}$/.test(v))
          return { code: "bad_shape" };
        dims[k] = v;
      }
    }
    if (
      event.value !== undefined &&
      (typeof event.value !== "number" || !Number.isFinite(event.value))
    )
      return { code: "bad_shape" };
    return {
      name: event.name,
      ts,
      dims,
      value: event.value as number | undefined,
      ineligible: registered?.unique_ineligible ?? false,
    };
  }
}
