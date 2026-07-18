"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { clsx } from "clsx";
import type { ReactNode } from "react";

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

/**
 * Tooltip — §8.2b: placement top/bottom · text-only / multi-metric rows.
 * W2 Radix convergence: hover/focus timing, positioning (offset 6, flip,
 * shift pad 8 → sideOffset/collisionPadding) and ARIA ride
 * @radix-ui/react-tooltip; the bubble chrome is the W1 Figma-QA'd markup.
 */
export function Tooltip({ content, placement = "top", children, className }: TooltipProps) {
  return (
    <TooltipPrimitive.Provider delayDuration={0} skipDelayDuration={0} disableHoverableContent>
      <TooltipPrimitive.Root>
        {/* wrapper spans preserved from the hand-rolled version — the W1
            layout (e.g. UptimeCard bar strips) depends on them */}
        <span className="relative inline-flex">
          <TooltipPrimitive.Trigger asChild>
            <span className="inline-flex">{children}</span>
          </TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              side={placement}
              sideOffset={6}
              collisionPadding={8}
              asChild
            >
              <span
                className={clsx(
                  // `block`: the W1 span computed to block via position:absolute;
                  // portaled popper content must keep block layout to paint
                  "font-ui block z-[var(--z-overlay)] w-max max-w-[280px] rounded-(--radius) border border-border",
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
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </span>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
