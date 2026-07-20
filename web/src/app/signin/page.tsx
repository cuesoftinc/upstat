"use client";

import { Zap } from "lucide-react";
import { useAuthController } from "@/controllers/auth";
import { GoogleAuthButton } from "@/components/ui/GoogleAuthButton";

/**
 * /signin — the single auth screen (X-1: Google sign-in only, product-wide;
 * flows/auth.md; route standard: /signin is the ONLY auth route — no
 * /login or /signup exists, and stale links 404 on the branded page
 * [Directive 2026-07-19]). One CTA, nothing else. Composition follows the
 * Login frame (124:6): centered zap + wordmark over "Sign in to your
 * organization"; the CTA itself stays the GoogleAuthButton canon (X-1).
 */
export default function SignInPage() {
  const { signInWithGoogle, loading, error } = useAuthController();

  return (
    <div
      data-testid="signin-screen"
      className="font-ui flex min-h-screen items-center justify-center bg-bg px-[var(--space-4)] text-text"
    >
      <main className="flex w-full max-w-[360px] flex-col items-center gap-[var(--space-6)] text-center">
        <header className="flex flex-col items-center gap-[var(--space-2)]">
          <h1 className="flex items-center gap-2 text-[24px] font-semibold">
            {/* brand mark = the filled zap glyph (adjudicated 2026-07-20) */}
            <Zap
              aria-hidden="true"
              fill="currentColor"
              strokeWidth={0}
              className="size-6 text-brand"
            />
            upstat
          </h1>
          <p className="text-[13px] leading-[1.45] text-text-2">
            Sign in to your organization
          </p>
        </header>

        <GoogleAuthButton
          onClick={() => void signInWithGoogle()}
          loading={loading}
          className="max-w-[280px]"
        />

        {error && (
          <p role="alert" className="text-[13px] leading-[1.45] text-crit">
            Sign-in failed. Please try again.
          </p>
        )}
      </main>
    </div>
  );
}
