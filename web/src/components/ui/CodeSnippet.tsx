"use client";

import { clsx } from "clsx";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export interface CodeSnippetTab {
  /** Tab label — Go / Python / Node / k8s (§8.2b). */
  label: string;
  code: string;
}

export interface CodeSnippetProps {
  tabs: CodeSnippetTab[];
  className?: string;
}

/**
 * CodeSnippet + Tabs — §8.2b: tab axis Go/Python/Node/k8s (active/inactive),
 * copy idle/copied-check, mono block on bg-elev.
 */
export function CodeSnippet({ tabs, className }: CodeSnippetProps) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(tabs[active].code);
    } catch {
      // non-secure context
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div
      className={clsx(
        "font-ui w-full overflow-hidden rounded-(--radius) border border-border bg-bg-elev",
        className,
      )}
    >
      <div className="flex items-center border-b border-border">
        <div role="tablist" aria-label="Language" className="flex flex-1">
          {tabs.map((tab, i) => (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => {
                setActive(i);
                setCopied(false);
              }}
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
          {tabs[active].code}
        </code>
      </pre>
    </div>
  );
}
