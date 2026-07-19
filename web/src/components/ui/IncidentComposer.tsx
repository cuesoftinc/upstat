"use client";

import * as Popover from "@radix-ui/react-popover";
import { clsx } from "clsx";
import { CornerDownLeft } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { IncidentPhase } from "@/models";

export interface ComposerSubmit {
  body: string;
  /** Parsed from `/status <phase>` when present. */
  phase?: IncidentPhase;
  /** Parsed from `/sev <n>` when present. */
  sev?: number;
}

export interface IncidentComposerProps {
  onSubmit: (update: ComposerSubmit) => void | Promise<void>;
  /** Posting state renders the optimistic-prepend affordance (MI-10). */
  posting?: boolean;
  className?: string;
}

interface SlashCommand {
  cmd: string;
  hint: string;
}

const COMMANDS: SlashCommand[] = [
  { cmd: "/status investigating", hint: "set phase" },
  { cmd: "/status identified", hint: "set phase" },
  { cmd: "/status monitoring", hint: "set phase" },
  { cmd: "/status resolved", hint: "resolve incident" },
  { cmd: "/sev 1", hint: "escalate" },
  { cmd: "/sev 2", hint: "set severity" },
  { cmd: "/sev 3", hint: "set severity" },
];

function parse(text: string): ComposerSubmit {
  const result: ComposerSubmit = { body: text.trim() };
  const status = text.match(
    /\/status\s+(investigating|identified|monitoring|resolved)/,
  );
  if (status) result.phase = status[1] as IncidentPhase;
  const sev = text.match(/\/sev\s+([1-4])/);
  if (sev) result.sev = Number(sev[1]);
  return result;
}

/**
 * IncidentComposer — §8.2b: idle / typing / slash-command autocomplete
 * (`/status`, `/sev`) / posting (optimistic prepend, MI-10).
 */
export function IncidentComposer({
  onSubmit,
  posting = false,
  className,
}: IncidentComposerProps) {
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // autocomplete opens while the caret word starts with `/`
  const slashWord = useMemo(() => {
    const words = text.split(/\s/);
    const last = words[words.length - 1] ?? "";
    return last.startsWith("/") ? text.slice(text.lastIndexOf("/")) : null;
  }, [text]);

  const suggestions = useMemo(
    () =>
      slashWord === null
        ? []
        : COMMANDS.filter((c) => c.cmd.startsWith(slashWord.toLowerCase())),
    [slashWord],
  );

  const pick = (cmd: string) => {
    setText((t) => t.slice(0, t.lastIndexOf("/")) + cmd + " ");
    inputRef.current?.focus();
  };

  const submit = async () => {
    if (!text.trim() || posting) return;
    await onSubmit(parse(text));
    setText("");
  };

  return (
    // W2 Radix convergence: the autocomplete rides @radix-ui/react-popover —
    // anchored to the composer box (side top / align start / offset 4 = the
    // W1 `bottom-full mb-1`), open state stays derived from the caret word,
    // focus never leaves the textarea (onOpenAutoFocus prevented).
    <Popover.Root open={suggestions.length > 0} onOpenChange={() => undefined}>
      <div
        className={clsx("font-ui relative", className)}
        data-state={posting ? "posting" : text ? "typing" : "idle"}
      >
        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={4}
            collisionPadding={8}
            onOpenAutoFocus={(e) => e.preventDefault()}
            asChild
          >
            <ul
              role="listbox"
              aria-label="Slash commands"
              // font-ui: portaled content no longer inherits it from the root div
              className="font-ui z-[var(--z-dropdown)] w-64 rounded-(--radius) border border-border bg-bg-elev py-1 shadow-lg"
            >
              {suggestions.map((s, i) => (
                <li key={s.cmd} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(s.cmd);
                    }}
                    onMouseEnter={() => setActive(i)}
                    className={clsx(
                      "flex w-full items-center justify-between px-2 py-1.5 text-left",
                      i === active && "bg-bg",
                    )}
                  >
                    <code className="font-data text-[12px] text-text">
                      {s.cmd}
                    </code>
                    <span className="text-[11px] text-text-2">{s.hint}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Popover.Content>
        </Popover.Portal>

        <Popover.Anchor asChild>
          <div
            className={clsx(
              "flex items-end gap-2 rounded-(--radius) border bg-bg p-2",
              "transition-colors duration-[var(--duration-fast)] ease-standard",
              posting
                ? "border-border opacity-70"
                : "border-border focus-within:border-brand",
            )}
          >
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (suggestions.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActive((a) => Math.min(a + 1, suggestions.length - 1));
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActive((a) => Math.max(a - 1, 0));
                    return;
                  }
                  if (e.key === "Tab" || e.key === "Enter") {
                    e.preventDefault();
                    pick(suggestions[active].cmd);
                    return;
                  }
                }
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                }
              }}
              rows={2}
              disabled={posting}
              placeholder="Post an update — /status resolved, /sev 2…"
              aria-label="Incident update"
              className="font-ui min-h-12 flex-1 resize-none bg-transparent text-[13px] leading-[1.45] text-text placeholder:text-text-2 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={posting || !text.trim()}
              aria-label="Post update"
              className={clsx(
                "flex h-7 items-center gap-1 rounded-(--radius) bg-brand px-2 text-[12px] font-medium text-on-brand",
                "transition-colors duration-[var(--duration-fast)] hover:bg-brand-deep",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {posting ? "Posting…" : "Post"}
              <CornerDownLeft aria-hidden="true" className="size-3" />
            </button>
          </div>
        </Popover.Anchor>
      </div>
    </Popover.Root>
  );
}
