"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { MonitorRow } from "@/components/ui/MonitorRow";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { UptimeCard } from "@/components/ui/UptimeCard";
import type { MonitorType } from "@/models";
import {
  monitorPillStatus,
  useMonitorsController,
  useUptimeCardsController,
} from "@/controllers/monitors";
import { ageLabel } from "@/controllers/shell";

/**
 * B7 Synthetics & Uptime (Figma 130:2120) — UptimeCards + the check list
 * (MonitorRow states ×6, mute toggles); "New check" creates an HTTP check
 * (the absorbed monitor core).
 */
export default function UptimePage() {
  const router = useRouter();
  const ctrl = useMonitorsController();
  const cards = useUptimeCardsController(ctrl.data);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [type, setType] = useState<string | null>("website");
  const [interval, setIntervalSec] = useState<string | null>("60");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const submit = async () => {
    setCreating(true);
    setError(null);
    try {
      const monitor = await ctrl.create({
        name: name.trim(),
        target: target.trim(),
        type: (type ?? "website") as MonitorType,
        interval_seconds: Number(interval ?? 60),
      });
      setCreateOpen(false);
      router.push(`/dashboard/uptime/${monitor.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not create the check");
    } finally {
      setCreating(false);
    }
  };

  const monitorsById = new Map((ctrl.data ?? []).map((m) => [m.id, m]));

  return (
    <div className="flex flex-col gap-6 px-6 py-5" data-testid="uptime-page">
      <header className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold">Synthetics &amp; Uptime</h1>
        <Button onClick={() => setCreateOpen(true)} data-testid="new-check">
          New check
        </Button>
      </header>

      {/* UptimeCard strips */}
      <section aria-label="Uptime overview" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {cards.loading || ctrl.loading ? (
          Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} kind="panel-axis" style={{ height: 96 }} />
          ))
        ) : (cards.data ?? []).length === 0 ? (
          <p className="text-[13px] text-text-2">No checks yet — create your first below.</p>
        ) : (
          (cards.data ?? []).map((history) => {
            const monitor = monitorsById.get(history.monitor_id);
            if (!monitor) return null;
            return (
              <UptimeCard
                key={history.monitor_id}
                name={monitor.name}
                days={history.days}
                uptimePct={history.uptime_90d_pct}
                p95Ms={monitor.last_response_time_ms ?? undefined}
                status={monitorPillStatus(monitor.status)}
              />
            );
          })
        )}
      </section>

      <section aria-labelledby="checks-heading">
        <h2 id="checks-heading" className="mb-3 text-[16px] font-semibold">
          Uptime checks
        </h2>
        {ctrl.loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} kind="line" />
            ))}
          </div>
        ) : (ctrl.data ?? []).length === 0 ? (
          <p className="rounded-(--radius) border border-border bg-bg-elev p-6 text-[13px] text-text-2">
            Create your first check — Monitors → New monitor.
          </p>
        ) : (
          <ul aria-label="Uptime checks">
            {(ctrl.data ?? []).map((m) => (
              <li key={m.id} data-testid={`monitor-${m.id}`}>
                <MonitorRow
                  status={monitorPillStatus(m.status)}
                  name={m.name}
                  summary={`uptime(check:${m.name.toLowerCase().replace(/\s+/g, "-")}) — ${m.target}`}
                  lastTriggered={
                    m.status === "pending"
                      ? "awaiting first check"
                      : m.muted
                        ? "muted"
                        : m.last_checked_at
                          ? `${ageLabel(m.last_checked_at)} ago`
                          : undefined
                  }
                  muted={m.muted}
                  onMutedChange={(muted) => void ctrl.setMuted(m.id, muted)}
                  onClick={() => router.push(`/dashboard/uptime/${m.id}`)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New uptime check"
        footer={
          <>
            <Button kind="quiet" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={creating || !name.trim() || !target.trim()}
              data-testid="create-check"
            >
              {creating ? "Creating…" : "Create check"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="text-text-2">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="api.cuesoft.io heartbeat" data-testid="check-name" />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="text-text-2">URL</span>
            <Input mono value={target} onChange={(e) => setTarget(e.target.value)} placeholder="https://api.cuesoft.io/healthz" data-testid="check-target" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-[13px]">
              <span className="text-text-2">Check type</span>
              <Select
                options={[
                  { value: "website", label: "Website" },
                  { value: "api", label: "API" },
                  { value: "server", label: "Server" },
                ]}
                value={type}
                onValueChange={setType}
                aria-label="Check type"
              />
            </label>
            <label className="flex flex-col gap-1 text-[13px]">
              <span className="text-text-2">Interval</span>
              <Select
                options={[
                  { value: "30", label: "30s" },
                  { value: "60", label: "60s" },
                  { value: "300", label: "5m" },
                ]}
                value={interval}
                onValueChange={setIntervalSec}
                aria-label="Interval"
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-[13px] text-crit">
              {error}
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
