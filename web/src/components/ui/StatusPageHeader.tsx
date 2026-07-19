"use client";

import { clsx } from "clsx";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

export type OverallStatus =
  | "operational"
  | "degraded"
  | "partial_outage"
  | "major_outage";

export interface StatusPageHeaderProps {
  /** Org heading — omitted in embeds (the landing v2 status embed, 135:471). */
  orgName?: string;
  overall: OverallStatus;
  /** RFC3339 last-updated timestamp. */
  lastUpdated: string;
  /** `relative` renders "Last updated 2m ago" (landing embed); default absolute UTC. */
  updatedFormat?: "absolute" | "relative";
  /** `banner` puts the last-updated label inside the banner, right-aligned
   *  (landing v2 embed, 135:471); default keeps it on its own line below. */
  updatedPlacement?: "below" | "banner";
  className?: string;
}

function relativeLabel(iso: string): string {
  const deltaMs = Date.now() - Date.parse(iso);
  const min = Math.max(Math.round(deltaMs / 60_000), 0);
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const COPY: Record<OverallStatus, string> = {
  operational: "All systems operational",
  degraded: "Degraded performance",
  partial_outage: "Partial outage",
  major_outage: "Major outage",
};

/** StatusPageHeader — §8.2: overall ×4 + last-updated ts (public page, B7). */
export function StatusPageHeader({
  orgName,
  overall,
  lastUpdated,
  updatedFormat = "absolute",
  updatedPlacement = "below",
  className,
}: StatusPageHeaderProps) {
  const updatedLabel = (
    <>
      Last updated{" "}
      {updatedFormat === "relative"
        ? relativeLabel(lastUpdated)
        : `${lastUpdated.replace("T", " ").slice(0, 19)} UTC`}
    </>
  );
  // Figma 75:862: outages (partial + major) carry crit + x-circle;
  // only degraded stays warn + triangle.
  const Icon =
    overall === "operational" ? CheckCircle2 : overall === "degraded" ? AlertTriangle : XCircle;
  return (
    <header
      data-overall={overall}
      className={clsx("font-ui flex flex-col gap-3", className)}
    >
      {orgName && <h1 className="text-[20px] font-semibold text-text">{orgName} status</h1>}
      <div
        className={clsx(
          "flex items-center gap-2 rounded-(--radius) border p-3",
          overall === "operational" && "border-ok/40 bg-ok/10",
          overall === "degraded" && "border-warn/40 bg-warn/10",
          overall === "partial_outage" && "border-crit/40 bg-crit/10",
          overall === "major_outage" && "border-crit bg-crit/15",
        )}
      >
        <Icon
          aria-hidden="true"
          className={clsx(
            "size-5",
            overall === "operational" && "text-ok",
            overall === "degraded" && "text-warn",
            (overall === "partial_outage" || overall === "major_outage") && "text-crit",
          )}
        />
        <span className="text-[16px] font-semibold text-text">{COPY[overall]}</span>
        {updatedPlacement === "banner" && (
          <span className="ml-auto text-[12px] tabular-nums text-text-2">{updatedLabel}</span>
        )}
      </div>
      {updatedPlacement === "below" && (
        <p className="text-[12px] tabular-nums text-text-2">{updatedLabel}</p>
      )}
    </header>
  );
}
