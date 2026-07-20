"use client";

import {
  AppearanceSection,
  IntegrationsSection,
  KeysSection,
  MembersSection,
  OrgSection,
  PrivacySection,
  RetentionSection,
  StatusPageSection,
  UsageLinkSection,
} from "./sections";

/**
 * B12 Settings — the composed two-column overview (Figma 132:3237).
 * Focused sub-screens live at /dashboard/settings/<area> (§4 route map).
 */
export default function SettingsPage() {
  return (
    <div data-testid="settings" className="flex flex-col gap-6 px-6 py-5">
      <h1 className="text-[20px] font-semibold">Settings</h1>
      <div className="grid gap-10 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-10">
          <OrgSection />
          <KeysSection />
          <MembersSection />
        </div>
        <div className="flex min-w-0 flex-col gap-10">
          <IntegrationsSection />
          <StatusPageSection />
          <UsageLinkSection />
          <RetentionSection />
          <AppearanceSection />
          <PrivacySection />
        </div>
      </div>
    </div>
  );
}
