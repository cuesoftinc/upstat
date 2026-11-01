import { Controller, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ApiError } from "../errors/api-error";
import { clientIp } from "../net/client-ip";
import { OtlpService, type Signal } from "./otlp.service";

/**
 * OTLP/HTTP at the standard paths, so a customer sets only
 * OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_HEADERS=Upstat-Ingest-Key=…
 * (§7.1). Protobuf or JSON, gzip passes through as sent.
 */
@Controller("v1")
export class OtlpController {
  constructor(private readonly otlp: OtlpService) {}

  @Post("traces")
  traces(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.export("traces", req, res);
  }

  @Post("metrics")
  metrics(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.export("metrics", req, res);
  }

  @Post("logs")
  logs(@Req() req: Request, @Res() res: Response): Promise<void> {
    return this.export("logs", req, res);
  }

  private async export(
    signal: Signal,
    req: Request,
    res: Response,
  ): Promise<void> {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const contentType = req.headers["content-type"] ?? "application/x-protobuf";
    if (!/^application\/(x-protobuf|protobuf|json)/.test(contentType)) {
      throw new ApiError(
        415,
        "unsupported_media_type",
        "OTLP is application/x-protobuf or application/json",
      );
    }
    const key =
      (req.headers["upstat-ingest-key"] as string | undefined) ??
      bearer(req.headers.authorization);
    const out = await this.otlp.ingest(
      signal,
      body,
      key ?? "",
      contentType,
      req.headers["content-encoding"] as string | undefined,
      clientIp(req),
    );
    res.status(out.status).type(out.contentType).send(out.body);
  }
}

export const bearer = (header?: string): string | undefined => {
  const [scheme, token] = (header ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token.trim() : undefined;
};
