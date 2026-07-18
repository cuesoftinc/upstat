"use client";

import { useOrgController } from "@/controllers/onboarding";

/**
 * B1 Home placeholder — the W3 stage builds the real org-health screen
 * (incident banner, triggered monitors, SLO burn, watched dashboards).
 * W0 proves the signin → dashboard flow and the controller → repository →
 * mock server path end to end.
 */
export default function DashboardHomePage() {
  const { data: org, loading } = useOrgController();

  return (
    <main
      data-testid="dashboard-home"
      className="mx-auto flex max-w-[960px] flex-col gap-[var(--space-4)] px-[var(--space-8)] py-[var(--space-12)]"
    >
      <h1 className="text-[20px] font-semibold">Home</h1>
      <p className="text-[13px] leading-[1.45] text-text-2">
        {loading
          ? "Loading org…"
          : org
            ? `${org.name} · ${org.timezone}`
            : "No organization yet."}
      </p>
      <p className="rounded-(--radius) border border-border bg-bg-elev p-[var(--space-4)] text-[13px] leading-[1.45] text-text-2">
        The observability pillars land here in W3 (pages.md Part B). This
        screen exists so W0 can prove sign-in, controllers, and the mock
        server end to end.
      </p>
    </main>
  );
}
