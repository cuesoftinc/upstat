import { DashboardShell } from "./shell";

/**
 * /dashboard — the observability app (pages.md Part B; route standard:
 * all app surfaces live under /dashboard/<area>). The shell carries the
 * NavRail + TopBar chrome, the global time provider (MI-1/MI-3) and the
 * MI-17 keyboard map. The rail's pre-paint width script lives in the root
 * layout beside the other boot scripts (railInitScript — CLS fix, perf
 * audit 2026-07-21).
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
