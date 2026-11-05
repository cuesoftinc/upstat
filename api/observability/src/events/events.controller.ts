import { gunzipSync, inflateSync } from "node:zlib";
import { Controller, HttpCode, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ApiError } from "../errors/api-error";
import { bearer } from "../otlp/otlp.controller";
import { clientIp } from "../net/client-ip";
import { IngressService } from "../net/ingress.service";
import { EventsService, type Accepted } from "./events.service";

/** A batch is at most 100 small events. */
export const EVENTS_MAX_BYTES = 256 * 1024;

const ENCODINGS = new Set(["", "identity", "gzip", "deflate"]);

const decode = (body: Buffer, encoding: string): Buffer => {
  if (encoding === "gzip" || encoding === "deflate") {
    try {
      const options = { maxOutputLength: EVENTS_MAX_BYTES };
      return encoding === "gzip"
        ? gunzipSync(body, options)
        : inflateSync(body, options);
    } catch {
      throw new ApiError(400, "bad_shape", "The body could not be decoded");
    }
  }
  return body;
};

/**
 * Product events and RUM beacons (api.md §3.1); 202 with per-item
 * rejections. The content type, the property key and its origin are
 * checked before the body is read; the body is metered as received.
 */
@Controller("v1/events")
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly ingress: IngressService,
  ) {}

  @Post()
  @HttpCode(202)
  async accept(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Accepted> {
    const origin = req.headers.origin;
    const encoding = String(req.headers["content-encoding"] ?? "")
      .trim()
      .toLowerCase();
    const ctx = {
      plainKey: bearer(req.headers.authorization) ?? "",
      // "null" is kept: it is an origin no allowlist can name.
      origin: origin || undefined,
      ip: clientIp(req),
      userAgent: String(req.headers["user-agent"] ?? ""),
    };
    const { checked: key, body } = await this.ingress.receive(
      req,
      res,
      async () => {
        if (!/^application\/json/i.test(req.headers["content-type"] ?? "")) {
          throw new ApiError(
            415,
            "unsupported_media_type",
            "Events are application/json",
          );
        }
        if (!ENCODINGS.has(encoding)) {
          throw new ApiError(
            415,
            "unsupported_media_type",
            "Content-Encoding is gzip, deflate or none",
          );
        }
        return this.events.authenticate(ctx);
      },
      EVENTS_MAX_BYTES,
    );
    let json: unknown;
    try {
      json = JSON.parse(decode(body, encoding).toString("utf8"));
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(400, "bad_shape", "The body is not valid JSON");
    }
    return this.events.accept(key, json, body.length, ctx);
  }
}
