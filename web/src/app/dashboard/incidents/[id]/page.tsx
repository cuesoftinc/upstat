"use client";

import { useParams } from "next/navigation";
import { AvatarStack } from "@/components/ui/Avatar";
import { IncidentComposer } from "@/components/ui/IncidentComposer";
import { IncidentHistoryEntry } from "@/components/ui/IncidentHistoryEntry";
import { SevChip, type Sev } from "@/components/ui/SevChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { Toast } from "@/components/ui/Toast";
import { useIncidentController } from "@/controllers/incidents";

/**
 * B9 incident timeline (Figma 131:2901) — MI-10 composer with slash
 * commands (`/status resolved`, `/sev 2`), optimistic prepend + rollback,
 * phase-stamped history. Status changes reflect on /status/{slug}.
 */
export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { incident, entries, postUpdate, posting, postError } = useIncidentController(id);

  if (incident.loading || !incident.data) {
    return (
      <div className="flex flex-col gap-4 px-6 py-5">
        <Skeleton kind="line" className="w-96" />
        <Skeleton kind="panel-axis" style={{ height: 200 }} />
      </div>
    );
  }

  const inc = incident.data;

  return (
    <div data-testid="incident-detail" className="flex max-w-[960px] flex-col gap-5 px-6 py-5">
      <header className="flex items-center gap-3">
        <SevChip sev={Math.min(inc.sev, 3) as Sev} />
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold">
          {inc.key} — {inc.title}
        </h1>
        <span className="flex items-center gap-2 text-[12px] text-text-2">
          responders
          <AvatarStack names={[inc.roles.commander, ...inc.roles.responders]} />
        </span>
      </header>

      <IncidentComposer
        posting={posting}
        onSubmit={(update) =>
          void postUpdate({
            body: update.body,
            phase: update.phase,
            sev: update.sev,
            author: inc.roles.commander,
          }).catch(() => undefined)
        }
      />

      {postError && <Toast kind="error" message={`Update failed — ${postError}`} />}

      <section aria-label="Timeline" className="flex flex-col">
        {entries.length === 0 ? (
          <p className="text-[13px] leading-[1.45] text-text-2">No updates yet.</p>
        ) : (
          <IncidentHistoryEntry
            updates={entries.map((e) => ({
              ts: e.ts,
              phase: e.phase,
              body: e.body,
              author: e.author,
            }))}
            variant="timeline"
            className="border-0"
          />
        )}
      </section>
    </div>
  );
}
