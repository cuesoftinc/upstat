"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthProvider, type AuthUser } from "@/auth";

/**
 * Auth controller — the single Google CTA flow (X-1, flows/auth.md).
 * Sign-in delegates to the active AuthProvider (TestModeAuthProvider in
 * TEST_MODE; FirebaseAuthProvider at backend-integration time).
 */
export function useAuthController() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await getAuthProvider().signInWithGoogle();
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign_in_failed");
      setLoading(false);
    }
  }, [router]);

  const signOut = useCallback(async () => {
    await getAuthProvider().signOut();
    router.push("/signin");
  }, [router]);

  return { signInWithGoogle, signOut, loading, error };
}

/**
 * Session read with the flows/auth.md §2 failure net: a failed restore
 * reads as **signed out** — a throwing provider can never strand a guard
 * at its loading state. Providers already contract to return null
 * (auth/provider.ts); this is the second net.
 */
function readSession(): AuthUser | null {
  try {
    return getAuthProvider().currentUser();
  } catch {
    return null;
  }
}

/**
 * Dashboard-side session gate (flows/auth.md §2, ratified 2026-07-22):
 * nothing under /dashboard paints until the session read settles — a
 * signed-out visitor is replaced to /signin. Deferred a tick (shell.ts
 * pattern): the session lives in per-tab sessionStorage, so
 * SSR/hydration must render without it; `checked` distinguishes "still
 * reading" from "signed out" so the shell can hold its loading state.
 */
export function useRequireAuth(): { user: AuthUser | null; checked: boolean } {
  const router = useRouter();
  const [state, setState] = useState<{
    user: AuthUser | null;
    checked: boolean;
  }>({ user: null, checked: false });

  useEffect(() => {
    const t = window.setTimeout(() => {
      const user = readSession();
      setState({ user, checked: true });
      if (!user) router.replace("/signin");
    }, 0);
    return () => window.clearTimeout(t);
  }, [router]);

  return state;
}

/**
 * Reverse guard for /signin (flows/auth.md §2, ratified 2026-07-22): a
 * signed-in user never sees the auth screen — the gate replaces to
 * /dashboard. A failed read is signed out (readSession), which lands on
 * the sign-in screen itself.
 */
export function useRedirectAuthed(): {
  user: AuthUser | null;
  checked: boolean;
} {
  const router = useRouter();
  const [state, setState] = useState<{
    user: AuthUser | null;
    checked: boolean;
  }>({ user: null, checked: false });

  useEffect(() => {
    const t = window.setTimeout(() => {
      const user = readSession();
      setState({ user, checked: true });
      if (user) router.replace("/dashboard");
    }, 0);
    return () => window.clearTimeout(t);
  }, [router]);

  return state;
}
