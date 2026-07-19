"use client";

import { IntegrationsSection } from "../sections";

/** B12 — integrations (webhooks, email channels; verify per flows/alert.md). */
export default function IntegrationsSettingsPage() {
  return (
    <div className="flex max-w-[720px] flex-col gap-6 px-6 py-5">
      <h1 className="text-[20px] font-semibold">Settings — integrations</h1>
      <IntegrationsSection />
    </div>
  );
}
