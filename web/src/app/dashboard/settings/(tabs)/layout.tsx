import { RouteTabs } from "@/components/ui/RouteTabs";
import { SETTINGS_TABS } from "../tabs";

/**
 * B12 `/dashboard/settings` — the Settings shell (ratified 2026-07-20):
 * page title + routed tab bar; every tab is a real sub-route rendering
 * one section pane, so tabs deep-link and back/forward work. The
 * NavRail's Settings pillar stays active across all sub-routes
 * (prefix match in activeKeyFor). The B7 status-page builder lives
 * outside this group — it keeps its focused full-screen layout.
 */
export default function SettingsTabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-testid="settings" className="flex flex-col gap-5 px-6 py-5">
      <h1 className="text-[20px] font-semibold">Settings</h1>
      <RouteTabs
        tabs={[...SETTINGS_TABS]}
        aria-label="Settings sections"
        paneClassName="max-w-[880px]"
      >
        {children}
      </RouteTabs>
    </div>
  );
}
