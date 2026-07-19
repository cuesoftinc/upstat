"use client";

import { OrgSection } from "../sections";

/** B12 — organization profile (name + IANA timezone, X-10). */
export default function OrgSettingsPage() {
  return (
    <div className="flex max-w-[720px] flex-col gap-6 px-6 py-5">
      <h1 className="text-[20px] font-semibold">Settings — organization</h1>
      <OrgSection />
    </div>
  );
}
