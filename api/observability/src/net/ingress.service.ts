import { Inject, Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { CONFIG, type Config } from "../config/config";
import { ApiError } from "../errors/api-error";

/** Bodies at or under this size are never counted against the concurrency cap. */
export const SMALL_BODY_BYTES = 64 * 1024;

const tooLarge = (max: number): ApiError =>
  new ApiError(413, "payload_too_large", `The body is over ${max} bytes`);

/** The declared Content-Length, or undefined (absent, chunked or malformed). */
export const declaredLength = (req: Request): number | undefined => {
  const raw = req.headers["content-length"];
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
};

/** The request body exactly as received on the wire, stopped at `max` bytes. */
export const readBody = (req: Request, max: number): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const done = (error?: ApiError): void => {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("close", onClose);
      if (error) {
        req.pause();
        reject(error);
      } else resolve(Buffer.concat(chunks, size));
    };
    const onData = (chunk: Buffer): void => {
      size += chunk.length;
      if (size > max) return done(tooLarge(max));
      chunks.push(chunk);
    };
    const onEnd = (): void => done();
    const onError = (): void =>
      done(new ApiError(400, "bad_request", "The body could not be read"));
    const onClose = (): void => {
      if (!req.complete)
        done(new ApiError(400, "bad_request", "The request was cut short"));
    };
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("close", onClose);
  });

/**
 * Reads ingest bodies only after the caller is accepted: `receive` runs the
 * pre-body checks (content type, key, source limit), then reads the bytes
 * as sent (never inflated), with a cap on how many large bodies are in
 * memory at once. A refusal before the body is read closes the connection
 * so the unread body is never drained.
 */
@Injectable()
export class IngressService {
  private inflight = 0;

  constructor(@Inject(CONFIG) private readonly config: Config) {}

  async receive<T>(
    req: Request,
    res: Response,
    check: () => Promise<T>,
    max = this.config.maxBodyBytes,
  ): Promise<{ checked: T; body: Buffer }> {
    let held = false;
    try {
      const checked = await check();
      const declared = declaredLength(req);
      if (declared !== undefined && declared > max) throw tooLarge(max);
      if (declared === undefined || declared > SMALL_BODY_BYTES) {
        if (this.inflight >= this.config.maxConcurrentBodies)
          throw new ApiError(503, "unavailable", "Ingest is busy; retry", {
            retry_after: 1,
          });
        this.inflight++;
        held = true;
      }
      return { checked, body: await readBody(req, max) };
    } catch (error) {
      res.setHeader("Connection", "close");
      throw error;
    } finally {
      if (held) this.inflight--;
    }
  }
}
