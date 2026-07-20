"use client";

import { MembersSection } from "../../sections";

/** B12 — Members tab: members & roles (engineering.md §2 matrix). */
export default function MembersSettingsPage() {
  return (
    <div className="flex max-w-[720px] flex-col gap-6">
      <MembersSection />
    </div>
  );
}
