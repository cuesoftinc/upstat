"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SevChip, type Sev } from "@/components/ui/SevChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { ageLabel } from "@/controllers/shell";
import { useIncidentsController } from "@/controllers/incidents";
import { DeclareIncidentModal } from "./DeclareIncidentModal";

/**
 * B9 incident feed (Figma 131:2901) + declare-incident modal (173:5805):
 * sev picker · title · commander assignment; declaring lands on the
 * timeline (MI-10) and reflects on the public status page.
 */
export default function IncidentsPage() {
  const router = useRouter();
  const { data, loading } = useIncidentsController();
  const [declareOpen, setDeclareOpen] = useState(false);

  return (
    <div data-testid="incidents" className="flex flex-col gap-6 px-6 py-5">
      <header className="flex items-center justify-between">
        <h1 className="text-[20px] font-semibold">Incidents</h1>
        <Button
          onClick={() => setDeclareOpen(true)}
          data-testid="declare-incident"
        >
          Declare incident
        </Button>
      </header>

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} kind="line" />
          ))}
        </div>
      ) : (data ?? []).length === 0 ? (
        <section
          aria-label="No incidents"
          className="rounded-(--radius) border border-border bg-bg-elev p-6 text-[13px] leading-[1.45] text-text-2"
        >
          No incidents — may it stay that way. Declare one manually or from a
          triggered alert.
        </section>
      ) : (
        <ul aria-label="Incident feed" className="flex flex-col">
          {(data ?? []).map((incident) => (
            <li key={incident.id}>
              <button
                type="button"
                onClick={() =>
                  router.push(`/dashboard/incidents/${incident.id}`)
                }
                data-testid={`incident-${incident.key}`}
                className="flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left transition-colors duration-[var(--duration-fast)] hover:bg-bg-elev"
              >
                <SevChip sev={Math.min(incident.sev, 3) as Sev} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">
                  {incident.key} — {incident.title}
                </span>
                <span
                  className={
                    incident.status === "resolved"
                      ? "text-[12px] uppercase tracking-wide text-ok-text"
                      : "text-[12px] uppercase tracking-wide text-warn-text"
                  }
                >
                  {incident.status}
                </span>
                <span className="w-24 shrink-0 text-right text-[12px] tabular-nums text-text-2">
                  {incident.status === "resolved"
                    ? "resolved"
                    : `open ${ageLabel(incident.started_at)}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <DeclareIncidentModal
        open={declareOpen}
        onClose={() => setDeclareOpen(false)}
      />
    </div>
  );
}
