import Link from "next/link";

/**
 * 404 — token-based, on-brand (design.md §2; MI catalog polish rules).
 */
export default function NotFound() {
  return (
    <div className="font-ui flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-text">
      <p className="font-data text-[13px] text-text-2">404</p>
      <h1 className="text-[24px] font-semibold">
        This page doesn&apos;t exist.
      </h1>
      <p className="max-w-[420px] text-center text-[13px] leading-[1.45] text-text-2">
        The address may have moved with the new dashboard IA. Everything lives
        under the app now.
      </p>
      <Link
        href="/dashboard"
        className="rounded-(--radius) bg-brand px-4 py-2 text-[13px] font-medium text-on-brand transition-colors duration-[var(--duration-fast)] hover:bg-brand-deep"
      >
        Go to the dashboard
      </Link>
    </div>
  );
}
