/**
 * Ecosystem error envelope (engineering.md §"envelope", normative):
 * `{"error": {"code": "snake_case_stable", "message": "human copy", "details": {}}}`
 * Codes are stable snake_case; cross-tenant access always reads `not_found`.
 */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/** Thrown by repositories when a response carries the error envelope. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody["error"]) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}
