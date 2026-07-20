"use client";

import { PrivacySection, RetentionSection } from "../../sections";

/**
 * B12 — Data & privacy tab (keeps the pre-tab /retention URL):
 * retention per signal + privacy/data controls.
 */
export default function RetentionSettingsPage() {
  return (
    <div className="flex max-w-[720px] flex-col gap-10">
      <RetentionSection />
      <PrivacySection />
    </div>
  );
}
