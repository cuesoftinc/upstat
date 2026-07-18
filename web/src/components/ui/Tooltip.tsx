"use client";

import { clsx } from "clsx";
import { useState, type ReactNode } from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
  autoUpdate,
} from "@floating-ui/react-dom";

export interface TooltipMetricRow {
  label: string;
  value: string;
}

export interface TooltipProps {
  /** text-only OR multi-metric rows (throughput · error · latency, §8.2b). */
  content: string | TooltipMetricRow[];
  placement?: "top" | "bottom";
  children: ReactNode;
  className?: string;
}

/** Tooltip — §8.2b: placement top/bottom · text-only / multi-metric rows. */
export function Tooltip({ content, placement = "top", children, className }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles } = useFloating({
    placement,
    middleware: [offset(6), flip(), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <span ref={refs.setReference} className="inline-flex">
        {children}
      </span>
      {open && (
        <span
          ref={refs.setFloating}
          style={floatingStyles}
          role="tooltip"
          className={clsx(
            "font-ui z-[var(--z-overlay)] w-max max-w-[280px] rounded-(--radius) border border-border",
            "bg-bg-elev px-2 py-1.5 text-[12px] leading-[1.45] text-text shadow-lg",
            className,
          )}
        >
          {typeof content === "string" ? (
            content
          ) : (
            <span className="flex flex-col gap-0.5">
              {content.map((row) => (
                <span key={row.label} className="flex items-center justify-between gap-4">
                  <span className="text-text-2">{row.label}</span>
                  <span className="font-data tabular-nums">{row.value}</span>
                </span>
              ))}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
