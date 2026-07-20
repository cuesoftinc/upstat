"use client";

import { AppearanceSection } from "../../sections";

/**
 * B12 — Appearance tab: tri-state theme (contract 2026-07-20) + §5
 * colorblind mode, side by side.
 */
export default function AppearanceSettingsPage() {
  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <AppearanceSection />
    </div>
  );
}
