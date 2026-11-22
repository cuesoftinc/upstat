"use client";

import "./globals.css";

/**
 * Last-resort error boundary: replaces the root layout when it crashes,
 * so it brings its own <html>/<body> and avoids providers and next/link.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main
          id="main"
          style={{
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          }}
          className="font-ui flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-text"
        >
          <h1 className="text-[24px] font-semibold">Something went wrong.</h1>
          <p className="max-w-[420px] text-center text-[13px] leading-[1.45] text-text-2">
            Upstat hit an unexpected error. You can try again, or head back to
            the dashboard.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => reset()}
              className="font-ui inline-flex h-8 items-center justify-center rounded-(--radius) bg-brand px-3 text-[13px] font-medium text-on-brand transition-colors hover:bg-brand-deep"
            >
              Try again
            </button>
            <a
              href="/dashboard"
              className="font-ui inline-flex h-8 items-center justify-center rounded-(--radius) border border-border bg-transparent px-3 text-[13px] font-medium text-text transition-colors hover:bg-bg-elev"
            >
              Go to the dashboard
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
