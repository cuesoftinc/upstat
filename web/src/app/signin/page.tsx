"use client";

import { useAuthController } from "@/controllers/auth";
import { BrandMark } from "@/components/ui/BrandMark";
import { GoogleAuthButton } from "@/components/ui/GoogleAuthButton";

/**
 * /signin — the single auth screen (X-1: Google sign-in only, product-wide;
 * flows/auth.md; route standard: /signin is the ONLY auth route — no
 * /login or /signup exists, and stale links 404 on the branded page
 * [Directive 2026-07-19]). One CTA, nothing else. Composition per the X-1
 * canon frame (124:6): centered bolt + wordmark over "Sign in to your
 * organization" over the Google CTA.
 */
export default function SignInPage() {
  const { signInWithGoogle, loading, error } = useAuthController();

  return (
    <div
      data-testid="signin-screen"
      className="font-ui flex min-h-screen items-center justify-center bg-bg px-[var(--space-4)] text-text"
    >
      <main className="flex w-full max-w-[360px] flex-col items-center gap-[var(--space-6)] text-center">
        <header className="flex flex-col items-center gap-[var(--space-3)]">
          <BrandMark
            wordmark
            className="gap-2.5 text-[26px]"
            glyphClassName="size-7"
          />
          <h1 className="text-[14px] font-normal leading-[1.45] text-text-2">
            Sign in to your organization
          </h1>
        </header>

        <GoogleAuthButton
          onClick={() => void signInWithGoogle()}
          loading={loading}
          className="w-full max-w-[280px]"
        />

        {error && (
          <p role="alert" className="text-[13px] leading-[1.45] text-crit">
            Sign-in failed. Please try again.
          </p>
        )}

        {/* Legal consent line (sibling parity: apparule/expendit signin) —
            links open the canonical Cuesoft policies in a new tab. */}
        <p className="text-[13px] leading-[1.45] text-text-2">
          By continuing you agree to the{" "}
          <a
            href="https://terms.cuesoft.io"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="https://privacy.cuesoft.io"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            Privacy Policy
          </a>
          .
        </p>
      </main>
    </div>
  );
}
