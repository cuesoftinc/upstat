"use client";

/**
 * MI-17 keyboard map — `g d` dashboards, `g l` logs, `g m` monitors,
 * ⌘K/Ctrl+K or `/` search, `?` overlay cheatsheet. Sequences time out
 * after 800ms; shortcuts never fire while typing in an
 * input/textarea/select — except ⌘K, which toggles the palette from
 * anywhere (fleet standard P12, expendit parity).
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ShortcutEntry } from "@/components/ui/ShortcutCheatsheet";

const SEQUENCE_TIMEOUT_MS = 800;

/** `g <key>` navigation targets (the MI-17 map + natural pillar extensions). */
export const GO_TARGETS: Record<string, { href: string; label: string }> = {
  h: { href: "/dashboard", label: "Home" },
  d: { href: "/dashboard/dashboards", label: "Dashboards" },
  e: { href: "/dashboard/metrics", label: "Metrics" },
  l: { href: "/dashboard/logs", label: "Logs" },
  t: { href: "/dashboard/traces", label: "Traces" },
  u: { href: "/dashboard/uptime", label: "Uptime" },
  m: { href: "/dashboard/monitors", label: "Monitors" },
  i: { href: "/dashboard/incidents", label: "Incidents" },
  s: { href: "/dashboard/slos", label: "SLOs" },
};

export const SHORTCUTS: ShortcutEntry[] = [
  { keys: "g d", label: "Go to dashboards" },
  { keys: "g l", label: "Go to logs" },
  { keys: "g m", label: "Go to monitors" },
  { keys: "g h", label: "Go to home" },
  { keys: "g t", label: "Go to traces" },
  { keys: "g i", label: "Go to incidents" },
  { keys: "⌘K", label: "Search" },
  { keys: "/", label: "Search" },
  { keys: "e", label: "Toggle dashboard edit mode" },
  { keys: "?", label: "This cheatsheet" },
];

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    target.isContentEditable
  );
}

export interface KeyboardMapState {
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  cheatsheetOpen: boolean;
  setCheatsheetOpen: (open: boolean) => void;
}

export function useKeyboardMap(): KeyboardMapState {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const pendingG = useRef<number | null>(null);

  const clearPending = useCallback(() => {
    if (pendingG.current !== null) {
      window.clearTimeout(pendingG.current);
      pendingG.current = null;
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Fleet-standard palette invocation (P12): ⌘K/Ctrl+K toggles the
      // palette alongside "/" (the log-search idiom stays). Handled ahead
      // of the modifier and typing-target guards — like expendit's, it
      // works from anywhere, inputs included.
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      // second key of a `g <key>` chord
      if (pendingG.current !== null) {
        const target = GO_TARGETS[e.key.toLowerCase()];
        clearPending();
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
        return;
      }

      if (e.key === "g") {
        pendingG.current = window.setTimeout(() => {
          pendingG.current = null;
        }, SEQUENCE_TIMEOUT_MS);
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setCheatsheetOpen((v) => !v);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      clearPending();
    };
  }, [router, clearPending]);

  return { paletteOpen, setPaletteOpen, cheatsheetOpen, setCheatsheetOpen };
}
