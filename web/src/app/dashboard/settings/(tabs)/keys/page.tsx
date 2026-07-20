"use client";

import { KeysSection } from "../../sections";

/**
 * B12 — Keys & properties tab: API keys & ingestion tokens (per-pillar
 * scopes, 24h rotation grace) + RUM property keys (issued by the B6
 * property-create flow; formerly the /properties focused screen).
 */
export default function KeysSettingsPage() {
  return (
    <div className="flex max-w-[880px] flex-col gap-10">
      <KeysSection kind="ingestion_token" />
      <KeysSection kind="property_key" />
    </div>
  );
}
