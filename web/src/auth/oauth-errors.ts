const OAUTH_ERROR_MESSAGES = new Map<string, string>([
  [
    "access_denied",
    "Google sign-in was cancelled. You can try again when you are ready.",
  ],
  ["missing_state", "Your sign-in session expired. Please try again."],
  [
    "invalid_state",
    "Your sign-in session could not be verified. Please try again.",
  ],
  ["expired_state", "Your sign-in session expired. Please try again."],
  ["missing_code", "Google did not complete sign-in. Please try again."],
  [
    "sso_failed",
    "Google sign-in is temporarily unavailable. Please try again.",
  ],
  [
    "server_error",
    "Google sign-in is temporarily unavailable. Please try again.",
  ],
  [
    "temporarily_unavailable",
    "Google sign-in is temporarily unavailable. Please try again.",
  ],
]);

const DEFAULT_OAUTH_ERROR =
  "Google sign-in could not be completed. Please try again.";

export const OAUTH_ERROR_KEYS = [
  "error",
  "error_description",
  "message",
] as const;

/** Message for an error the API redirected back with; null when the URL carries none. */
export function getOAuthRedirectErrorMessage(
  params: URLSearchParams,
): string | null {
  const code = params.get("error")?.trim().toLowerCase();
  const hasDetail = OAUTH_ERROR_KEYS.some((key) =>
    Boolean(params.get(key)?.trim()),
  );
  if (!code && !hasDetail) return null;
  return (code && OAUTH_ERROR_MESSAGES.get(code)) || DEFAULT_OAUTH_ERROR;
}

export class SsoRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

export function getSsoCompletionErrorMessage(error: unknown): string {
  if (error instanceof SsoRequestError) {
    if (error.code === "handoff_invalid") {
      return "Your sign-in session expired or was already used. Please try again.";
    }
    if (error.status === 0) {
      return "We could not reach Upstat. Check your connection and try again.";
    }
    if (error.status >= 500) {
      return "Google sign-in is temporarily unavailable. Please try again.";
    }
  }
  return DEFAULT_OAUTH_ERROR;
}
