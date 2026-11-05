import { HttpException } from "@nestjs/common";

/** The ecosystem error envelope: {"error": {code, message, details}}. */
export class ApiError extends HttpException {
  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super({ error: { code, message, details } }, status);
  }
}

/** The retryable refusal: a dependency is down; the sender's retry is the buffer. */
export const unavailable = (retryAfter = 5): ApiError =>
  new ApiError(503, "unavailable", "Ingest is temporarily unavailable; retry", {
    retry_after: retryAfter,
  });
