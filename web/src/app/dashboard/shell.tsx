"use client";

/**
 * /dashboard shell — NavRail (12 pillars) + TopBar chrome (org switcher,
 * global TimePicker, `/` search, MI-14 bell), the persistent IncidentBanner,
 * the MI-17 keyboard map (`g …`, `/`, `?` cheatsheet) and the global time
 * provider (MI-1/MI-3). Views render inside the single <main> landmark.
 */

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useMemo, useState, type ReactNode } from "react";
import { CommandPalette, type CommandItem } from "@/components/ui/CommandPalette";
import { IncidentBanner } from "@/components/ui/IncidentBanner";
import { NavRail, NAV_PILLARS } from "@/components/ui/NavRail";
import { NotificationPopover } from "@/components/ui/AlertFeedRow";
import { ShortcutCheatsheet } from "@/components/ui/ShortcutCheatsheet";
import { TimePicker, type TimePreset } from "@/components/ui/TimePicker";
import { TopBar } from "@/components/ui/TopBar";
import { ZoomStackChip } from "@/components/ui/ZoomStackChip";
import { ageLabel, useShellController } from "@/controllers/shell";
import { SHORTCUTS, useKeyboardMap } from "@/controllers/keyboard";
import { TimeRangeProvider, useTimeRange } from "@/controllers/time-range";
import type { Sev } from "@/components/ui/SevChip";

/** NavRail pillar key → route (web-implementation.md §4 route map). */
export const PILLAR_ROUTES: Record<string, string> = {
  home: "/dashboard",
  dashboards: "/dashboard/dashboards",
  metrics: "/dashboard/metrics",
  logs: "/dashboard/logs",
  traces: "/dashboard/traces",
  rum: "/dashboard/rum",
  uptime: "/dashboard/uptime",
  monitors: "/dashboard/monitors",
  incidents: "/dashboard/incidents",
  slos: "/dashboard/slos",
  catalog: "/dashboard/services",
  settings: "/dashboard/settings",
};

function activeKeyFor(pathname: string): string {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/onboarding")) return "home";
  const entries = Object.entries(PILLAR_ROUTES).filter(([key]) => key !== "home");
  const hit = entries.find(([, route]) => pathname.startsWith(route));
  return hit?.[0] ?? "home";
}

const PALETTE_KBD: Record<string, string> = {
  home: "g h",
  dashboards: "g d",
  metrics: "g e",
  logs: "g l",
  traces: "g t",
  uptime: "g u",
  monitors: "g m",
  incidents: "g i",
  slos: "g s",
};

function GlobalTimePicker() {
  const time = useTimeRange();
  return (
    <span className="flex items-center gap-2">
      {time.zoomDepth > 0 && (
        <ZoomStackChip depth={time.zoomDepth} label={time.zoomLabel} onReset={time.resetZoom} />
      )}
      <TimePicker
        value={time.preset}
        onChange={(preset) => {
          if (preset !== "custom") time.setPreset(preset as TimePreset);
        }}
        live={time.live}
        onLiveChange={time.setLive}
      />
    </span>
  );
}

function ShellChrome({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const shell = useShellController();
  const keys = useKeyboardMap();
  const [bellOpen, setBellOpen] = useState(false);
  const [orgOpen, setOrgOpen] = useState(false);

  const paletteItems: CommandItem[] = useMemo(
    () =>
      NAV_PILLARS.map((p) => ({
        id: p.key,
        label: p.label,
        icon: p.icon,
        kbd: PALETTE_KBD[p.key],
      })),
    [],
  );

  const banner = shell.bannerIncident;

  return (
    <div className="font-ui flex min-h-screen bg-bg text-text">
      <NavRail
        activeKey={activeKeyFor(pathname)}
        onNavigate={(key) => router.push(PILLAR_ROUTES[key] ?? "/dashboard")}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative">
          <TopBar
            orgName={shell.org.data?.name ?? "…"}
            env="prod"
            onOrgClick={() => setOrgOpen((v) => !v)}
            timePicker={<GlobalTimePicker />}
            onSearchClick={() => keys.setPaletteOpen(true)}
            unreadCount={shell.unread}
            bellFlash={shell.unread > 0 && bellOpen === false}
            onBellClick={() => setBellOpen((v) => !v)}
          />

          {/* org switcher — the second, empty org walks onboarding (§6) */}
          {orgOpen && (
            <nav
              aria-label="Organizations"
              className="absolute left-2 top-full z-[var(--z-dropdown)] w-64 rounded-(--radius) border border-border bg-bg-elev py-1 shadow-xl"
            >
              <ul>
                {(shell.orgs.data ?? []).map((org) => (
                  <li key={org.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOrgOpen(false);
                        if (org.id !== shell.org.data?.id) void shell.switchOrg(org.id);
                      }}
                      aria-current={org.id === shell.org.data?.id ? "true" : undefined}
                      className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] text-text transition-colors duration-[var(--duration-fast)] hover:bg-bg"
                    >
                      <span className="truncate">{org.name}</span>
                      {org.id === shell.org.data?.id && (
                        <span aria-hidden="true" className="text-brand">
                          ✓
                        </span>
                      )}
                    </button>
                  </li>
                ))}
                <li className="mt-1 border-t border-border pt-1">
                  <button
                    type="button"
                    data-testid="new-org"
                    onClick={() => {
                      setOrgOpen(false);
                      shell.newOrg();
                    }}
                    className="w-full px-3 py-1.5 text-left text-[13px] text-brand transition-colors duration-[var(--duration-fast)] hover:bg-bg"
                  >
                    + New organization
                  </button>
                </li>
              </ul>
            </nav>
          )}

          {bellOpen && (
            <div className="absolute right-2 top-full z-[var(--z-dropdown)]">
              <NotificationPopover
                events={shell.feed.data ?? []}
                onEventClick={() => {
                  setBellOpen(false);
                  router.push("/dashboard/monitors");
                }}
              />
            </div>
          )}
        </div>

        {/* MI-14: persistent banner while a sev1/2 incident is open */}
        {banner && (
          <IncidentBanner
            sev={Math.min(banner.sev, 3) as Sev}
            title={`${banner.key} — ${banner.title}`}
            age={ageLabel(banner.started_at)}
            responders={[banner.roles.commander, ...banner.roles.responders]}
            onClick={() => router.push(`/dashboard/incidents/${banner.id}`)}
          />
        )}

        <main id="main" className="min-w-0 flex-1 overflow-y-auto">
          {/* Suspense above every page: screens read useSearchParams (deep
              links, ?edit=1, ?service=…) and static prerender requires a
              boundary (missing-suspense-with-csr-bailout). */}
          <Suspense fallback={null}>{children}</Suspense>
        </main>
      </div>

      <CommandPalette
        open={keys.paletteOpen}
        onClose={() => keys.setPaletteOpen(false)}
        items={paletteItems}
        onSelect={(item) => {
          keys.setPaletteOpen(false);
          router.push(PILLAR_ROUTES[item.id] ?? "/dashboard");
        }}
      />
      {keys.cheatsheetOpen && (
        <ShortcutCheatsheet
          open
          onClose={() => keys.setCheatsheetOpen(false)}
          shortcuts={SHORTCUTS}
        />
      )}
    </div>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <TimeRangeProvider>
      <ShellChrome>{children}</ShellChrome>
    </TimeRangeProvider>
  );
}
