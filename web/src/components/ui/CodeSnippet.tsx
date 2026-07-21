"use client";

import { clsx } from "clsx";
import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";

export interface CodeSnippetTab {
  /** Tab label — Go / Python / Node / k8s (§8.2b) or an install method. */
  label: string;
  code: string;
}

export interface CodeSnippetProps {
  tabs: CodeSnippetTab[];
  /** Accessible name for the tablist (the §8.2b language axis by default). */
  tabsLabel?: string;
  /**
   * Shell-command mode (A14 self-host, Figma 413:2): each code line renders
   * a decorative select-none `$ ` prompt in the brand command color — the
   * copy payload stays the raw commands, prompt-free.
   */
  prompt?: boolean;
  className?: string;
}

/**
 * CodeSnippet + Tabs — §8.2b: tab axis Go/Python/Node/k8s (active/inactive),
 * copy idle/copied-check, mono block on bg-elev. The tablist carries roving
 * tabindex + Arrow/Home/End focus; copy always targets the ACTIVE tab.
 */
export function CodeSnippet({
  tabs,
  tabsLabel = "Language",
  prompt = false,
  className,
}: CodeSnippetProps) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tabs[active].code);
    } catch {
      // non-secure context
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const select = (i: number) => {
    setActive(i);
    setCopied(false);
  };

  const onTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      className={clsx(
        "font-ui w-full overflow-hidden rounded-(--radius) border border-border bg-bg-elev",
        className,
      )}
    >
      <div className="flex items-center border-b border-border">
        <div role="tablist" aria-label={tabsLabel} className="flex flex-1">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={i === active}
              tabIndex={i === active ? 0 : -1}
              onClick={() => select(i)}
              onKeyDown={(event) => onTabKeyDown(event, i)}
              className={clsx(
                "px-3 py-2 text-[13px] font-medium transition-colors duration-[var(--duration-fast)]",
                i === active
                  ? "border-b-2 border-brand text-text"
                  : "text-text-2 hover:text-text",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label="Copy snippet"
          onClick={() => void copy()}
          className="px-3 text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
        >
          {copied ? (
            <Check className="size-4 text-ok" />
          ) : (
            <Copy className="size-4" />
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="font-data text-[13px] leading-[1.6] text-text">
          {prompt
            ? tabs[active].code.split("\n").map((line) => (
                <span
                  key={line}
                  className="block whitespace-nowrap text-brand-text"
                >
                  <span aria-hidden="true" className="select-none">
                    {"$ "}
                  </span>
                  {line}
                </span>
              ))
            : tabs[active].code}
        </code>
      </pre>
    </div>
  );
}
