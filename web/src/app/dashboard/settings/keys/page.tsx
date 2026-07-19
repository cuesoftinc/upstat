"use client";

import { KeysSection } from "../sections";

/** B12 — API keys & ingestion tokens (per-pillar scopes, 24h rotation grace). */
export default function KeysSettingsPage() {
  return (
    <div className="flex max-w-[880px] flex-col gap-6 px-6 py-5">
      <h1 className="text-[20px] font-semibold">Settings — API keys</h1>
      <KeysSection kind="ingestion_token" />
    </div>
  );
}
