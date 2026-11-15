"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

/**
 * Route-level error boundary: a render error inside a page lands here
 * instead of Next's unbranded default. Same token styling as not-found.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main"
      tabIndex={-1}
      className="font-ui flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-text"
    >
      <h1 className="text-[24px] font-semibold">Something went wrong.</h1>
      <p className="max-w-[420px] text-center text-[13px] leading-[1.45] text-text-2">
        This page hit an unexpected error. You can try again, or head back to
        the dashboard.
      </p>
      <div className="flex items-center gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Link
          href="/dashboard"
          className="font-ui inline-flex h-8 items-center justify-center rounded-(--radius) border border-border bg-transparent px-3 text-[13px] font-medium text-text transition-colors duration-[var(--duration-fast)] hover:bg-bg-elev focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Go to the dashboard
        </Link>
      </div>
    </main>
  );
}
