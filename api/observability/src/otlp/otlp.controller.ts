import { Controller, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ApiError } from "../errors/api-error";
import { clientIp } from "../net/client-ip";
import { IngressService } from "../net/ingress.service";
import { OtlpService, type Signal } from "./otlp.service";

/**
 * OTLP/HTTP at the standard paths, so a customer sets only
 * OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_HEADERS=Upstat-Ingest-Key=…
 * (§7.1). Protobuf or JSON; the bytes and Content-Encoding pass through
 * exactly as sent. The key and content type are checked before the body
 * is read.
 */
@Controller("v1")
export class OtlpController {
  constructor(
    private readonly otlp: OtlpService,
    private readonly ingress: IngressService,
  ) {}

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
    const contentType = req.headers["content-type"] ?? "application/x-protobuf";
    const plainKey =
      (req.headers["upstat-ingest-key"] as string | undefined) ??
      bearer(req.headers.authorization) ??
      "";
    const ip = clientIp(req);
    const { checked: key, body } = await this.ingress.receive(
      req,
      res,
      async () => {
        if (!/^application\/(x-protobuf|protobuf|json)/.test(contentType)) {
          throw new ApiError(
            415,
            "unsupported_media_type",
            "OTLP is application/x-protobuf or application/json",
          );
        }
        return this.otlp.authenticate(plainKey, ip);
      },
    );
    const out = await this.otlp.ingest(
      signal,
      body,
      key,
      contentType,
      req.headers["content-encoding"] as string | undefined,
    );
    res.status(out.status).type(out.contentType).send(out.body);
  }
}

export const bearer = (header?: string): string | undefined => {
  const [scheme, token] = (header ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token.trim() : undefined;
};
