"use client";

/**
 * SignInGate — the /signin reverse guard (flows/auth.md §2, ratified
 * 2026-07-22: restore resolves before either surface routes; a signed-in
 * user never sees the auth screen). Wraps the screen content (metadata
 * stays on the signin layout): signed in → replace to /dashboard
 * (useRedirectAuthed), session read in flight → an aria-busy hold
 * (per-tab sessionStorage, one deferred tick — a negligible beat); only
 * signed out renders the CTA. DashboardShell holds the mirror-image gate
 * (useRequireAuth).
 */

import type { ReactNode } from "react";
import { useRedirectAuthed } from "@/controllers/auth";

export function SignInGate({ children }: { children: ReactNode }) {
  const { user, checked } = useRedirectAuthed();

  if (!checked || user) {
    // Covers both the in-flight read and the signed-in replace-in-progress.
    return (
      <div
        aria-busy="true"
        data-testid="signin-gate"
        className="flex min-h-screen items-center justify-center bg-bg"
      >
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  return <>{children}</>;
}
