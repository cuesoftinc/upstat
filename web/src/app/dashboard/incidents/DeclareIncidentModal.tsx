"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useIncidentsController } from "@/controllers/incidents";
import { useSettingsController } from "@/controllers/settings";

export interface DeclareIncidentModalProps {
  open: boolean;
  onClose: () => void;
  /** Prefill for the from-an-alert path (pages.md B9 [Directive]). */
  initialTitle?: string;
  initialSev?: string;
}

/**
 * Declare-incident modal (Figma 173:5805; pages.md B9 [Directive]) —
 * reachable from an alert row (prefilled) or manually: sev picker · title
 * · commander assignment; declaring lands on the incident timeline.
 */
export function DeclareIncidentModal({
  open,
  onClose,
  initialTitle = "",
  initialSev = "1",
}: DeclareIncidentModalProps) {
  const router = useRouter();
  const { declare } = useIncidentsController();
  const { members } = useSettingsController();
  const [title, setTitle] = useState(initialTitle);
  const [sev, setSev] = useState(initialSev);
  const [commander, setCommander] = useState<string | null>(null);
  const [declaring, setDeclaring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // reset per-open (render-phase derive-state pattern; the prefill from a
  // different alert row must replace stale fields)
  const openKey = open ? `${initialTitle}|${initialSev}` : "closed";
  const [lastKey, setLastKey] = useState(openKey);
  if (lastKey !== openKey) {
    setLastKey(openKey);
    if (open) {
      setTitle(initialTitle);
      setSev(initialSev);
      setCommander(null);
      setError(null);
    }
  }

  const submit = async () => {
    if (!title.trim() || !commander) {
      setError("Give the incident a title and a commander.");
      return;
    }
    setDeclaring(true);
    setError(null);
    try {
      const incident = await declare({ title: title.trim(), sev: Number(sev), commander });
      router.push(`/dashboard/incidents/${incident.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not declare the incident.");
      setDeclaring(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Declare incident"
      footer={
        <>
          <Button kind="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            kind="destructive"
            onClick={() => void submit()}
            disabled={declaring}
            data-testid="confirm-declare"
          >
            {declaring ? "Declaring…" : "Declare"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-[13px]">
          <span className="text-text-2">Title</span>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Elevated error rate on /v1/events"
            data-testid="incident-title"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="text-text-2">Severity</span>
            <Select
              options={["1", "2", "3", "4"].map((s) => ({ value: s, label: `SEV-${s}` }))}
              value={sev}
              onValueChange={setSev}
              aria-label="Severity"
            />
          </label>
          <label className="flex flex-col gap-1 text-[13px]">
            <span className="text-text-2">Commander</span>
            <Select
              options={(members.data ?? [])
                .filter((m) => m.status === "active")
                .map((m) => ({ value: m.name, label: m.name }))}
              value={commander}
              onValueChange={setCommander}
              placeholder="assign…"
              aria-label="Commander"
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
  );
}
