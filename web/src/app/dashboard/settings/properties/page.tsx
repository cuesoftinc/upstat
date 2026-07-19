"use client";

import { KeysSection } from "../sections";

/** B12 — RUM property keys (issued by the B6 property-create flow). */
export default function PropertiesSettingsPage() {
  return (
    <div className="flex max-w-[880px] flex-col gap-6 px-6 py-5">
      <h1 className="text-[20px] font-semibold">Settings — properties</h1>
      <KeysSection kind="property_key" />
    </div>
  );
}
