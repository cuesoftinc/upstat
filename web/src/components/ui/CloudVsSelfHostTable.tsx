"use client";

import { clsx } from "clsx";
import { Check, Minus } from "lucide-react";
import { Button } from "./Button";

export interface PlanFeatureRow {
  feature: string;
  cloud: boolean;
  selfHost: boolean;
}

export interface CloudVsSelfHostTableProps {
  rows?: PlanFeatureRow[];
  onTryCloud?: () => void;
  onSelfHost?: () => void;
  /** Header/CTA overrides — the landing v2 instance (Figma 135:688) uses
   *  an empty feature header, "Upstat Cloud", and "Deploy with compose".
   *  An empty featureHeader stays visually blank but keeps an sr-only
   *  "Feature" label so the column header is never empty for AT. */
  featureHeader?: string;
  cloudHeader?: string;
  selfHostHeader?: string;
  selfHostCta?: string;
  className?: string;
}

/** Default rows — MIT copy + “Managed upgrades & backups” per the §8.2b as-built notes. */
const DEFAULT_ROWS: PlanFeatureRow[] = [
  { feature: "Every pillar — no feature gates", cloud: true, selfHost: true },
  { feature: "MIT-licensed source", cloud: true, selfHost: true },
  { feature: "Your telemetry on your box", cloud: false, selfHost: true },
  { feature: "Managed upgrades & backups", cloud: true, selfHost: false },
  { feature: "One-line docker compose install", cloud: false, selfHost: true },
  { feature: "Zero-ops onboarding", cloud: true, selfHost: false },
];

/** CloudVsSelfHostTable — §8.2b: 2 plan columns × feature rows + CTA footers (A9). */
export function CloudVsSelfHostTable({
  rows = DEFAULT_ROWS,
  onTryCloud,
  onSelfHost,
  featureHeader = "Feature",
  cloudHeader = "Cloud",
  selfHostHeader = "Self-host",
  selfHostCta = "Self Host",
  className,
}: CloudVsSelfHostTableProps) {
  const Mark = ({ yes }: { yes: boolean }) =>
    yes ? (
      <Check aria-label="included" className="mx-auto size-4 text-ok" />
    ) : (
      <Minus aria-label="not included" className="mx-auto size-4 text-nodata" />
    );

  return (
    <table
      className={clsx(
        "font-ui w-full max-w-2xl border-collapse overflow-hidden rounded-(--radius) border border-border",
        className,
      )}
    >
      <thead>
        <tr className="border-b border-border bg-bg-elev">
          <th
            scope="col"
            className="p-3 text-left text-[13px] font-semibold text-text"
          >
            {/* axe empty-table-header (a11y audit 2026-07-21): the landing
                instance passes "" — keep the visual blank, name the column */}
            {featureHeader || <span className="sr-only">Feature</span>}
          </th>
          <th
            scope="col"
            className="w-32 p-3 text-center text-[13px] font-semibold text-text"
          >
            {cloudHeader}
          </th>
          <th
            scope="col"
            className="w-32 p-3 text-center text-[13px] font-semibold text-text"
          >
            {selfHostHeader}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.feature} className="border-b border-border">
            <td className="p-3 text-[13px] leading-[1.45] text-text">
              {row.feature}
            </td>
            <td className="p-3 text-center">
              <Mark yes={row.cloud} />
            </td>
            <td className="p-3 text-center">
              <Mark yes={row.selfHost} />
            </td>
          </tr>
        ))}
      </tbody>
      {/* CTA footer rides the plan columns from sm up; below sm the section
          composes its own grouped CTA block (the column-aligned buttons read
          detached from their snippet at 390 — live-QA finding 2026-07-19). */}
      <tfoot className="hidden sm:table-footer-group">
        <tr>
          <td className="p-3" />
          <td className="p-3 text-center">
            <Button
              kind="brand"
              size="sm"
              className="whitespace-nowrap"
              onClick={onTryCloud}
            >
              Try Cloud
            </Button>
          </td>
          <td className="p-3 text-center">
            <Button
              kind="quiet"
              size="sm"
              className="whitespace-nowrap"
              onClick={onSelfHost}
            >
              {selfHostCta}
            </Button>
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
