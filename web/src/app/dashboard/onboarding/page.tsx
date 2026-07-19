"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { CodeSnippet } from "@/components/ui/CodeSnippet";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useFirstDataPoll,
  useOnboardingController,
} from "@/controllers/onboarding";

const FALLBACK_TIMEZONES = [
  "UTC",
  "Africa/Lagos",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
];

function timezoneOptions(): { value: string; label: string }[] {
  const zones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : FALLBACK_TIMEZONES;
  return zones.map((z) => ({ value: z, label: z }));
}

/**
 * B1 first-run onboarding (pages.md B1; Figma onboarding frames):
 * create-org (name + IANA timezone, X-10) → send-your-first-data
 * (ingestion key + copyable snippet + MI-16 waiting-for-data radar);
 * resolves to /dashboard on the first datapoint.
 */
export default function OnboardingPage() {
  const {
    data: onboarding,
    loading,
    createOrg,
    creating,
    reload,
  } = useOnboardingController();
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState<string | null>("UTC");
  const [error, setError] = useState<string | null>(null);
  const options = useMemo(() => timezoneOptions(), []);

  // Step 2 while the active org waits for data; step 1 otherwise.
  const waiting =
    !!onboarding && onboarding.org_created && !onboarding.has_data;
  const hasData = useFirstDataPoll(waiting);

  // first datapoint landed — the radar pings and B1 takes over (full
  // navigation so every controller re-reads the fresh org)
  useEffect(() => {
    if (hasData) window.location.assign("/dashboard");
  }, [hasData]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createOrg(name.trim(), timezone ?? "UTC");
      await reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "could not create the organization",
      );
    }
  };

  return (
    <div
      data-testid="onboarding"
      className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-6 py-10"
    >
      {loading && !onboarding ? (
        <Skeleton kind="panel-axis" style={{ height: 200 }} />
      ) : waiting ? (
        <section
          aria-labelledby="first-data-heading"
          className="flex flex-col gap-4"
        >
          <header>
            <h1 id="first-data-heading" className="text-[20px] font-semibold">
              Send your first data
            </h1>
            <p className="mt-1 text-[13px] leading-[1.45] text-text-2">
              Point an OpenTelemetry SDK or collector at Upstat with your
              ingestion key. The moment the first datapoint lands, this org
              lights up.
            </p>
          </header>

          <dl className="flex items-center gap-3 rounded-(--radius) border border-border bg-bg-elev px-3 py-2">
            <dt className="text-[12px] text-text-2">Ingestion key</dt>
            <dd
              className="font-data m-0 text-[12px] text-text"
              data-testid="ingest-key"
            >
              {onboarding?.ingest_key}
            </dd>
          </dl>

          <CodeSnippet
            tabs={[
              {
                label: "Go",
                code: `export UPSTAT_INGEST_KEY=${onboarding?.ingest_key}\nexport OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.upstat.cuesoft.io:4318`,
              },
              {
                label: "Node",
                code: `UPSTAT_INGEST_KEY=${onboarding?.ingest_key} \\\nOTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.upstat.cuesoft.io:4318 node app.js`,
              },
              {
                label: "k8s",
                code: `kubectl create secret generic upstat --from-literal=key=${onboarding?.ingest_key}`,
              },
            ]}
          />

          <EmptyState pillar="metrics" waiting />
        </section>
      ) : (
        <section
          aria-labelledby="create-org-heading"
          className="flex flex-col gap-4"
        >
          <header>
            <h1 id="create-org-heading" className="text-[20px] font-semibold">
              Create your organization
            </h1>
            <p className="mt-1 text-[13px] leading-[1.45] text-text-2">
              Name it and pick a reporting timezone — dashboards, uptime day
              boundaries and reports render in it (storage stays UTC).
            </p>
          </header>

          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-[13px]">
              <span className="text-text-2">Organization name</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc"
                required
                data-testid="org-name"
              />
            </label>

            <label className="flex flex-col gap-1 text-[13px]">
              <span className="text-text-2">Timezone (IANA)</span>
              <Select
                options={options}
                value={timezone}
                onValueChange={setTimezone}
                typeahead
                aria-label="Timezone"
              />
            </label>

            {error && (
              <p role="alert" className="text-[13px] text-crit">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={creating || name.trim().length === 0}
              data-testid="create-org"
            >
              {creating ? "Creating…" : "Create organization"}
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
