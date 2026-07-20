"use client";

import { IntegrationsSection, StatusPageSection } from "../../sections";

/**
 * B12 — Integrations tab: alert channels (webhooks, email; verify per
 * flows/alert.md) + the status-page builder handoff card (the B7
 * builder stays a focused sub-screen at /dashboard/settings/status-page).
 */
export default function IntegrationsSettingsPage() {
  return (
    <div className="flex max-w-[720px] flex-col gap-10">
      <IntegrationsSection />
      <StatusPageSection />
    </div>
  );
}
