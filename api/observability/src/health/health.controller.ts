import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import type { Response } from "express";
import { ConfigCacheService } from "../config-cache/config-cache.service";
import { ConfigConsumerService } from "../config-cache/config-consumer.service";

@Controller()
export class HealthController {
  constructor(
    private readonly cache: ConfigCacheService,
    private readonly consumer: ConfigConsumerService,
  ) {}

  /** Liveness: the process is up (also the wake-up target). */
  @Get("health")
  health() {
    return { status: "up" };
  }

  /** Readiness: keys and registry loaded, config reloads flowing. */
  @Get("ready")
  ready(@Res() response: Response) {
    const ok = this.cache.loaded && this.consumer.running;
    response
      .status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json({ status: ok ? "ready" : "not_ready" });
  }
}
