"use client";

/**
 * B12 settings sections (Figma 132:3237) — the routed tab panes under
 * /dashboard/settings/<tab> (ratified 2026-07-20, §4 route map).
 * Views render controller state only; all mutations ride the controllers.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import { APIKeyRow } from "@/components/ui/APIKeyRow";
import { AlertChannelCard } from "@/components/ui/AlertChannelCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { MemberRow } from "@/components/ui/MemberRow";
import { Select } from "@/components/ui/Select";
import { SettingsRow } from "@/components/ui/SettingsRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Toast } from "@/components/ui/Toast";
import type { ApiKeyWithSecret, KeyScope, MemberRole } from "@/models";
import { useAlertsController } from "@/controllers/alerts";
import { useOrgController } from "@/controllers/onboarding";
import { useSettingsController } from "@/controllers/settings";
import { useColorVision } from "@/design/ColorVisionProvider";
import { useTheme, type ThemePreference } from "@/design/ThemeProvider";

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className="text-[16px] font-semibold text-text">
      {children}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/* Organization (name + IANA timezone, X-10)                            */
/* ------------------------------------------------------------------ */

const FALLBACK_TIMEZONES = [
  "UTC",
  "Africa/Lagos",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
];

export function OrgSection() {
  const { data: org, loading, update } = useOrgController();
  const [name, setName] = useState<string | null>(null);
  const [weeklyReport, setWeeklyReport] = useState(true);
  const [saved, setSaved] = useState(false);

  const tzOptions = useMemo(() => {
    const zones =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : FALLBACK_TIMEZONES;
    return zones.map((z) => ({ value: z, label: z }));
  }, []);

  if (loading || !org)
    return <Skeleton kind="panel-axis" style={{ height: 180 }} />;

  const effectiveName = name ?? org.name;
  const pulse = () => {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  return (
    <section aria-labelledby="org-heading" className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <SectionHeading id="org-heading">Organization</SectionHeading>
        {saved && (
          <span className="rounded-(--radius) bg-ok/15 px-2 py-0.5 text-[12px] text-ok">
            Saved
          </span>
        )}
      </div>
      <SettingsRow
        label="Organization name"
        description="Shown on invoices, status pages and reports"
        control={
          <span className="flex items-center gap-2">
            <Input
              value={effectiveName}
              onChange={(e) => setName(e.target.value)}
              aria-label="Organization name"
              className="w-56"
              data-testid="org-name-input"
            />
            {effectiveName !== org.name && (
              <Button
                size="sm"
                onClick={() => void update({ name: effectiveName }).then(pulse)}
                data-testid="org-name-save"
              >
                Save
              </Button>
            )}
          </span>
        }
      />
      <SettingsRow
        label="Org timezone"
        description="All reports and time buckets render in this timezone · storage stays UTC"
        control={
          <Select
            options={tzOptions}
            value={org.timezone}
            onValueChange={(tz) => void update({ timezone: tz }).then(pulse)}
            typeahead
            aria-label="Org timezone"
            className="min-w-48"
          />
        }
      />
      <SettingsRow
        label="Weekly email report"
        description="Send a Monday summary of uptime, SLOs and incidents"
        control={
          <Switch
            checked={weeklyReport}
            onCheckedChange={setWeeklyReport}
            aria-label="Weekly email report"
          />
        }
      />
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* API keys & ingestion tokens                                          */
/* ------------------------------------------------------------------ */

export function KeysSection({
  kind,
}: {
  kind?: "ingestion_token" | "property_key";
}) {
  const { keys, createKey, rotateKey, revokeKey } = useSettingsController();
  const [secret, setSecret] = useState<ApiKeyWithSecret | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newScope, setNewScope] = useState<KeyScope>(
    kind === "property_key" ? "rum" : "all",
  );

  const list = (keys.data ?? []).filter((k) => !kind || k.kind === kind);
  const isProperties = kind === "property_key";

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await createKey({
        kind: kind ?? "ingestion_token",
        name: newName.trim(),
        scope: isProperties ? "rum" : newScope,
      });
      setSecret(created);
      setNewName("");
    } finally {
      setCreating(false);
    }
  };

  return (
    <section
      aria-labelledby={isProperties ? "properties-heading" : "keys-heading"}
      className="flex flex-col gap-3"
    >
      <SectionHeading id={isProperties ? "properties-heading" : "keys-heading"}>
        {isProperties ? "Property keys (RUM)" : "API keys & ingestion tokens"}
      </SectionHeading>

      {keys.loading ? (
        <Skeleton kind="line" />
      ) : list.length === 0 ? (
        <p className="text-[13px] leading-[1.45] text-text-2">
          {isProperties
            ? "No RUM properties yet — create one to get a browser snippet."
            : "No ingestion tokens yet."}
        </p>
      ) : (
        <ul className="flex flex-col">
          {list.map((key) => (
            <li key={key.id} className="flex items-center gap-2">
              <APIKeyRow
                apiKey={key}
                onRevoke={() => void revokeKey(key.id)}
                className="min-w-0 flex-1"
              />
              {key.status === "active" && (
                <Button
                  kind="quiet"
                  size="sm"
                  onClick={() => void rotateKey(key.id).then(setSecret)}
                  data-testid={`rotate-${key.id}`}
                >
                  Rotate
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* one-time secret reveal (creation/rotation only) */}
      {secret && (
        <div className="flex flex-col gap-2 rounded-(--radius) border border-brand/40 bg-bg-elev p-3">
          <p className="text-[12px] text-text-2">
            Copy this key now — it is only shown once. Previous key stays valid
            for 24h (rotation grace).
          </p>
          <code
            data-testid="key-secret"
            className="font-data break-all text-[12px] text-text"
          >
            {secret.key}
          </code>
          <Toast
            kind="success"
            message={`${secret.name} key issued`}
            onDismiss={() => setSecret(null)}
          />
        </div>
      )}

      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={
            isProperties ? "site domain, e.g. upstat.cuesoft.io" : "key name"
          }
          aria-label={isProperties ? "Property domain" : "Key name"}
          className="w-64"
          data-testid="new-key-name"
        />
        {!isProperties && (
          <Select
            options={["all", "otlp", "rum", "statsd"].map((s) => ({
              value: s,
              label: s,
            }))}
            value={newScope}
            onValueChange={(s) => setNewScope(s as KeyScope)}
            aria-label="Key scope"
            className="min-w-28"
          />
        )}
        <Button
          type="submit"
          size="sm"
          disabled={creating || newName.trim().length === 0}
          data-testid="create-key"
        >
          {creating
            ? "Creating…"
            : isProperties
              ? "Create property"
              : "Create key"}
        </Button>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Members & roles                                                      */
/* ------------------------------------------------------------------ */

export function MembersSection() {
  const { members, inviteMember, setMemberRole } = useSettingsController();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("member");
  const [inviting, setInviting] = useState(false);

  const invite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    try {
      await inviteMember(email.trim(), role);
      setEmail("");
    } finally {
      setInviting(false);
    }
  };

  return (
    <section aria-labelledby="members-heading" className="flex flex-col gap-3">
      <SectionHeading id="members-heading">Members &amp; roles</SectionHeading>
      {members.loading ? (
        <Skeleton kind="line" />
      ) : (
        <ul className="flex flex-col">
          {(members.data ?? []).map((member) => (
            <li key={member.id}>
              <MemberRow
                member={member}
                onRoleChange={(r) => void setMemberRole(member.id, r)}
              />
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void invite();
        }}
      >
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@cuesoft.io"
          aria-label="Invite email"
          className="w-64"
          data-testid="invite-email"
        />
        <Select
          options={(["member", "admin", "owner"] as const).map((r) => ({
            value: r,
            label: r,
          }))}
          value={role}
          onValueChange={(r) => setRole(r as MemberRole)}
          aria-label="Invite role"
          className="min-w-28"
        />
        <Button
          type="submit"
          size="sm"
          disabled={inviting || email.trim().length === 0}
          data-testid="invite-member"
        >
          {inviting ? "Inviting…" : "Invite"}
        </Button>
      </form>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Integrations (channels), retention, privacy                          */
/* ------------------------------------------------------------------ */

export function IntegrationsSection() {
  const { channels, verifyChannel, removeChannel } = useAlertsController();
  return (
    <section
      aria-labelledby="integrations-heading"
      className="flex flex-col gap-3"
    >
      <SectionHeading id="integrations-heading">Integrations</SectionHeading>
      {channels.loading ? (
        <Skeleton kind="line" />
      ) : (
        <ul className="flex flex-col gap-2">
          {(channels.data ?? []).map((channel) => (
            <li key={channel.id}>
              <AlertChannelCard
                channel={channel}
                onVerify={() => void verifyChannel(channel.id)}
                onDelete={() => void removeChannel(channel.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const RETENTION_ROWS = [
  { label: "Metrics", value: "15 months of rollups" },
  { label: "Logs", value: "30 days indexed" },
  { label: "Traces", value: "15 days, tail-sampled" },
  { label: "RUM events", value: "13 months" },
];

export function RetentionSection() {
  return (
    <section
      aria-labelledby="retention-heading"
      className="flex flex-col gap-3"
    >
      <SectionHeading id="retention-heading">
        Retention per signal
      </SectionHeading>
      <dl className="flex flex-col gap-2">
        {RETENTION_ROWS.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-(--radius) border border-border bg-bg-elev px-3 py-2"
          >
            <dt className="text-[13px] font-medium text-text">{row.label}</dt>
            <dd className="font-data m-0 text-[12px] text-text-2">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const PRIVACY_ROWS = [
  {
    label: "Cookieless visitor model",
    value: "daily-rotating salt, no cross-day tracking",
  },
  { label: "Raw IP addresses", value: "never stored" },
  { label: "Export & delete", value: "self-serve via API, org-scoped" },
];

/* ------------------------------------------------------------------ */
/* Status page (B7 builder handoff, [Designed 2026-07-20])              */
/* ------------------------------------------------------------------ */

export function StatusPageSection() {
  return (
    <section
      aria-labelledby="status-page-heading"
      className="flex flex-col gap-3"
    >
      <SectionHeading id="status-page-heading">Status page</SectionHeading>
      <div className="flex items-center justify-between gap-4 rounded-(--radius) border border-border bg-bg-elev px-3 py-2">
        <span className="text-[13px] leading-[1.45] text-text-2">
          Branding, slug and the published component list
        </span>
        <Link
          href="/dashboard/settings/status-page"
          className="shrink-0 rounded-(--radius) border border-border px-3 py-1.5 text-[13px] text-text transition-colors duration-[var(--duration-fast)] hover:bg-bg"
          data-testid="open-status-page-builder"
        >
          Open builder →
        </Link>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Appearance (theme-parity canon, SKILL.md 2026-07-19)                 */
/* ------------------------------------------------------------------ */

export function AppearanceSection() {
  // Tri-state theme (contract 2026-07-20) + §5 colorblind mode (Wave A) —
  // the two Appearance controls integrate side by side.
  const { preference, setPreference } = useTheme();
  const { patterns, setMode } = useColorVision();
  return (
    <section
      aria-labelledby="appearance-heading"
      className="flex flex-col gap-3"
    >
      <SectionHeading id="appearance-heading">Appearance</SectionHeading>
      <div className="flex items-center justify-between gap-4 rounded-(--radius) border border-border bg-bg-elev px-3 py-2">
        <span className="text-[13px] font-medium text-text">Theme</span>
        {/* Tri-state (theme contract 2026-07-20): System follows the OS
            live; Dark stays the product's design default. */}
        <Select
          options={[
            { value: "system", label: "System" },
            { value: "dark", label: "Dark (default)" },
            { value: "light", label: "Light" },
          ]}
          value={preference}
          onValueChange={(v) => setPreference(v as ThemePreference)}
          aria-label="Theme"
          className="min-w-36"
        />
      </div>
      {/* §5 colorblind mode — persisted at `upstat.colorvision` like the
          theme contract; charts add pattern fills/dashes, dot-only status
          pills gain glyphs */}
      <div className="flex items-center justify-between gap-4 rounded-(--radius) border border-border bg-bg-elev px-3 py-2">
        <span className="flex min-w-0 flex-col">
          <span className="text-[13px] font-medium text-text">
            Color vision
          </span>
          <span className="text-[12px] leading-[1.45] text-text-2">
            Differentiate chart series with patterns and dashes, not color alone
          </span>
        </span>
        <Switch
          checked={patterns}
          onCheckedChange={(on) => setMode(on ? "patterns" : "default")}
          aria-label="Color vision patterns"
        />
      </div>
    </section>
  );
}

export function PrivacySection() {
  return (
    <section aria-labelledby="privacy-heading" className="flex flex-col gap-3">
      <SectionHeading id="privacy-heading">
        Privacy &amp; data controls
      </SectionHeading>
      <dl className="flex flex-col gap-2">
        {PRIVACY_ROWS.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 rounded-(--radius) border border-border bg-bg-elev px-3 py-2"
          >
            <dt className="text-[13px] font-medium text-text">{row.label}</dt>
            <dd className="font-data m-0 text-right text-[12px] text-text-2">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
