"use client";

import { useAuthController } from "@/controllers/auth";
import { GoogleAuthButton } from "@/components/ui/GoogleAuthButton";

/**
 * /login — the single auth screen (X-1: Google sign-in only, product-wide;
 * flows/auth.md). One CTA, nothing else. /signup is retired.
 */
export default function LoginPage() {
  const { signInWithGoogle, loading, error } = useAuthController();

  return (
    <div
      data-testid="login-screen"
      className="font-ui flex min-h-screen items-center justify-center bg-bg px-[var(--space-4)] text-text"
    >
      <main className="flex w-full max-w-[360px] flex-col gap-[var(--space-6)]">
        <header className="flex flex-col gap-[var(--space-2)]">
          <span
            aria-hidden="true"
            className="mb-[var(--space-2)] inline-flex size-8 items-center justify-center rounded-(--radius) bg-brand text-[15px] font-semibold text-on-brand"
          >
            U
          </span>
          <h1 className="text-[20px] font-semibold">Sign in to Upstat</h1>
          <p className="text-[13px] leading-[1.45] text-text-2">
            Continue with your Google account — it&apos;s the only sign-in
            Upstat has.
          </p>
        </header>

        <GoogleAuthButton onClick={() => void signInWithGoogle()} loading={loading} />

        {error && (
          <p role="alert" className="text-[13px] leading-[1.45] text-crit">
            Sign-in failed. Please try again.
          </p>
        )}
      </main>
    </div>
  );
}
