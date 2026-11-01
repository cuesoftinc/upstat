import { Controller, HttpCode, Post, Req } from "@nestjs/common";
import type { Request } from "express";
import { bearer } from "../otlp/otlp.controller";
import { clientIp } from "../net/client-ip";
import { EventsService, type Accepted } from "./events.service";

/** Product events and RUM beacons (api.md §3.1); 202 with per-item rejections. */
@Controller("v1/events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @HttpCode(202)
  accept(@Req() req: Request): Promise<Accepted> {
    const origin = req.headers.origin;
    return this.events.accept(
      req.body,
      Number(req.headers["content-length"] ?? 0),
      {
        plainKey: bearer(req.headers.authorization) ?? "",
        origin: origin && origin !== "null" ? origin : undefined,
        ip: clientIp(req),
        userAgent: String(req.headers["user-agent"] ?? ""),
      },
    );
  }
}
