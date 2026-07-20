/**
 * B12 settings tab manifest — the routed sub-tabs under
 * /dashboard/settings (ratified 2026-07-20, design-lane grouping).
 * Each entry is a REAL sub-route; the bare /dashboard/settings
 * redirects to the first tab. Usage and Data & privacy keep their
 * pre-tab URLs (/usage, /retention); the B7 status-page builder stays
 * a focused sub-screen linked from the Integrations tab.
 */
export const SETTINGS_TABS = [
  { href: "/dashboard/settings/general", label: "General" },
  { href: "/dashboard/settings/members", label: "Members" },
  { href: "/dashboard/settings/keys", label: "Keys & properties" },
  { href: "/dashboard/settings/integrations", label: "Integrations" },
  { href: "/dashboard/settings/retention", label: "Data & privacy" },
  { href: "/dashboard/settings/appearance", label: "Appearance" },
  { href: "/dashboard/settings/usage", label: "Usage" },
] as const;

export const FIRST_SETTINGS_TAB = SETTINGS_TABS[0].href;
