"use client";

import { OrgSection } from "../../sections";

/** B12 — General tab: organization profile (name + IANA timezone, X-10). */
export default function GeneralSettingsPage() {
  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <OrgSection />
    </div>
  );
}
