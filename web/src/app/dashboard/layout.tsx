import { DashboardShell } from "./shell";

/**
 * /dashboard — the observability app (pages.md Part B; route standard:
 * all app surfaces live under /dashboard/<area>). The shell carries the
 * NavRail + TopBar chrome, the global time provider (MI-1/MI-3) and the
 * MI-17 keyboard map; the legacy dashboard tree is quarantined in
 * src/legacy/app/dashboard.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
