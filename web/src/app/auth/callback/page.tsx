"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  OAUTH_ERROR_KEYS,
  getOAuthRedirectErrorMessage,
  getSsoCompletionErrorMessage,
} from "@/auth/oauth-errors";
import {
  exchangeHandoff,
  isValidHandoff,
  storeToken,
  takeVerifier,
} from "@/auth/sso-client";

/**
 * /auth/callback: the API redirects here with a one-time handoff code after
 * Google sign-in; the page trades it for a session and enters the dashboard.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const startedRef = useRef(false);
  const [message, setMessage] = useState<string | null>(null);
  const fail = useCallback((text: string) => setMessage(text), []);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const redirectError = getOAuthRedirectErrorMessage(params);
    const handoff = params.get("handoff");
    // Strip the one-time code and error details from history right away.
    for (const key of ["handoff", ...OAUTH_ERROR_KEYS]) params.delete(key);
    const rest = params.toString();
    window.history.replaceState(
      null,
      "",
      window.location.pathname + (rest ? `?${rest}` : ""),
    );

    queueMicrotask(() => {
      if (redirectError) {
        fail(redirectError);
        return;
      }
      const verifier = takeVerifier();
      if (!isValidHandoff(handoff) || !verifier) {
        fail("Your sign-in session expired. Please try again.");
        return;
      }
      exchangeHandoff(handoff, verifier)
        .then((token) => {
          storeToken(token);
          router.replace("/dashboard");
        })
        .catch((error) => fail(getSsoCompletionErrorMessage(error)));
    });
  }, [router, fail]);

  if (!message) {
    return (
      <div
        aria-busy="true"
        data-testid="auth-callback-loading"
        className="font-ui flex min-h-screen items-center justify-center bg-bg text-text-2"
      >
        <p className="text-[14px]">Signing You In…</p>
      </div>
    );
  }

  return (
    <div className="font-ui flex min-h-screen items-center justify-center bg-bg px-[var(--space-4)] text-text">
      <main className="flex w-full max-w-[360px] flex-col items-center gap-[var(--space-4)] text-center">
        <h1 className="text-[20px] font-medium">Sign-In Was Interrupted</h1>
        <p
          role="alert"
          data-testid="auth-callback-error"
          className="text-[14px] leading-[1.45] text-text-2"
        >
          {message}
        </p>
        <a
          href="/signin"
          className="text-[14px] underline underline-offset-2 hover:text-text"
        >
          Back to Sign In
        </a>
      </main>
    </div>
  );
}
