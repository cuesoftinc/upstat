"use client";

import { MembersSection } from "../sections";

/** B12 — members & roles (engineering.md §2 matrix). */
export default function MembersSettingsPage() {
  return (
    <div className="flex max-w-[720px] flex-col gap-6 px-6 py-5">
      <h1 className="text-[20px] font-semibold">Settings — members</h1>
      <MembersSection />
    </div>
  );
}
