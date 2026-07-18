"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthProvider } from "@/auth";

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
      router.push("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "sign_in_failed");
      setLoading(false);
    }
  }, [router]);

  const signOut = useCallback(async () => {
    await getAuthProvider().signOut();
    router.push("/login");
  }, [router]);

  return { signInWithGoogle, signOut, loading, error };
}
