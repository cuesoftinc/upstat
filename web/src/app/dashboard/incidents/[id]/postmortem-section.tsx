"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IncidentHistoryEntry } from "@/components/ui/IncidentHistoryEntry";
import { Modal } from "@/components/ui/Modal";
import type {
  Incident,
  Postmortem,
  PostmortemInput,
  TimelineEntry,
} from "@/models";

export interface PostmortemSectionProps {
  incident: Incident;
  postmortem: Postmortem | null;
  /** Current timeline entries (newest-first) — the composer's auto-fill preview. */
  entries: TimelineEntry[];
  onSave: (input: PostmortemInput) => Promise<void>;
  saving: boolean;
  error: string | null;
  className?: string;
}

const FIELD_CLASS =
  "w-full rounded-(--radius) border border-border bg-bg px-2.5 py-2 text-[13px] leading-[1.45] text-text outline-none transition-colors duration-[var(--duration-fast)] focus:border-brand";

/**
 * B9 postmortem — "postmortem doc template on resolve": resolved incidents
 * gain a **Start postmortem** composer (modal): the incident timeline
 * auto-filled read-only (frozen into the doc on save by the mock), plus
 * impact / root-cause / action-items sections. The saved doc renders on
 * the incident detail and stamps `postmortem_key`. Render-only — state
 * and I/O live in useIncidentController.
 */
export function PostmortemSection({
  incident,
  postmortem,
  entries,
  onSave,
  saving,
  error,
  className,
}: PostmortemSectionProps) {
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [actions, setActions] = useState("");

  // postmortems attach on resolve (pages.md B9) — nothing to offer before
  if (incident.status !== "resolved" && !postmortem) return null;

  const openComposer = () => {
    setImpact(postmortem?.impact ?? "");
    setRootCause(postmortem?.root_cause ?? "");
    setActions(postmortem?.action_items.join("\n") ?? "");
    setOpen(true);
  };

  const submit = async () => {
    try {
      await onSave({
        author: incident.roles.commander,
        impact,
        root_cause: rootCause,
        action_items: actions
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      });
      setOpen(false);
    } catch {
      // controller surfaces the error; the modal stays open for a retry
    }
  };

  // oldest-first for reading order (entries arrive newest-first)
  const preview = [...entries].reverse();

  return (
    <section
      aria-labelledby="postmortem-heading"
      data-testid="postmortem"
      className={className}
    >
      <header className="mb-3 flex items-center gap-3">
        <h2 id="postmortem-heading" className="text-[16px] font-semibold">
          Postmortem
        </h2>
        <div className="flex-1" />
        {postmortem ? (
          <Button kind="quiet" size="sm" onClick={openComposer}>
            Edit postmortem
          </Button>
        ) : (
          <Button size="sm" onClick={openComposer} data-testid="start-postmortem">
            Start postmortem
          </Button>
        )}
      </header>

      {postmortem ? (
        <article className="flex flex-col gap-4 rounded-(--radius) border border-border bg-bg-elev p-4">
          <p className="font-data text-[12px] text-text-2">
            {postmortem.author} · updated {postmortem.updated_at.slice(0, 10)}
          </p>
          <div>
            <h3 className="mb-1 text-[13px] font-semibold text-text">
              Impact
            </h3>
            <p className="text-[13px] leading-[1.45] text-text-2">
              {postmortem.impact}
            </p>
          </div>
          <div>
            <h3 className="mb-1 text-[13px] font-semibold text-text">
              Root cause
            </h3>
            <p className="text-[13px] leading-[1.45] text-text-2">
              {postmortem.root_cause}
            </p>
          </div>
          <div>
            <h3 className="mb-1 text-[13px] font-semibold text-text">
              Action items
            </h3>
            <ul className="list-disc pl-5 text-[13px] leading-[1.45] text-text-2">
              {postmortem.action_items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="mb-1 text-[13px] font-semibold text-text">
              Timeline
            </h3>
            <IncidentHistoryEntry
              updates={[...postmortem.timeline].reverse()}
              variant="timeline"
              className="border-0"
            />
          </div>
        </article>
      ) : (
        <p className="rounded-(--radius) border border-border bg-bg-elev p-4 text-[13px] leading-[1.45] text-text-2">
          Resolved — capture the write-up while it&apos;s fresh. The timeline
          fills in automatically.
        </p>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Postmortem — ${incident.key}`}
        variant="lg"
        footer={
          <>
            <Button kind="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={saving}
              data-testid="save-postmortem"
            >
              {saving ? "Saving…" : "Save postmortem"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="mb-1.5 text-[13px] font-semibold text-text">
              Timeline (auto-filled)
            </h3>
            <ol className="font-data flex max-h-40 flex-col gap-1 overflow-y-auto rounded-(--radius) border border-border bg-bg p-2 text-[12px] leading-[1.45]">
              {preview.map((entry) => (
                <li key={entry.id} className="flex gap-2">
                  <span className="shrink-0 tabular-nums text-text-2">
                    {entry.ts.slice(11, 16)}
                  </span>
                  <span className="shrink-0 uppercase text-text-2">
                    {entry.phase}
                  </span>
                  <span className="min-w-0 text-text">{entry.body}</span>
                </li>
              ))}
            </ol>
          </div>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text">
            Impact
            <textarea
              rows={3}
              value={impact}
              onChange={(e) => setImpact(e.target.value)}
              placeholder="Who/what was affected, for how long?"
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text">
            Root cause
            <textarea
              rows={3}
              value={rootCause}
              onChange={(e) => setRootCause(e.target.value)}
              placeholder="What actually broke, and why did it get through?"
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium text-text">
            Action items (one per line)
            <textarea
              rows={3}
              value={actions}
              onChange={(e) => setActions(e.target.value)}
              placeholder={"Add the canary gate\nAlert on edge 5xx"}
              className={FIELD_CLASS}
            />
          </label>
          {error && (
            <p role="alert" className="text-[12px] text-crit">
              Save failed — {error}
            </p>
          )}
        </div>
      </Modal>
    </section>
  );
}
