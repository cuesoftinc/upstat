"use client";

import { PrivacySection, RetentionSection } from "../sections";

/** B12 — retention per signal + privacy/data controls. */
export default function RetentionSettingsPage() {
  return (
    <div className="flex max-w-[720px] flex-col gap-10 px-6 py-5">
      <h1 className="text-[20px] font-semibold">Settings — retention</h1>
      <RetentionSection />
      <PrivacySection />
    </div>
  );
}
