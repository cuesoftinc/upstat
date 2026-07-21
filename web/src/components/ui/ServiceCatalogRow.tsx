"use client";

import { clsx } from "clsx";
import { ExternalLink } from "lucide-react";
import type { ServiceCatalogEntry } from "@/models";
import { Tooltip } from "./Tooltip";

export interface ServiceCatalogRowProps {
  entry: ServiceCatalogEntry;
  onClick?: () => void;
  className?: string;
}

const PILLARS: {
  key: keyof ServiceCatalogEntry["telemetry"];
  label: string;
}[] = [
  { key: "metrics", label: "metrics" },
  { key: "logs", label: "logs" },
  { key: "traces", label: "traces" },
  { key: "rum", label: "RUM" },
];

/**
 * ServiceCatalogRow — §8.2b: telemetry presence dots per pillar
 * (present/absent ×4) · owner + repo/runbook links · default/hover.
 */
export function ServiceCatalogRow({
  entry,
  onClick,
  className,
}: ServiceCatalogRowProps) {
  return (
    <div
      className={clsx(
        "font-ui flex h-10 items-center gap-3 border-b border-border px-3",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-elev",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="font-data w-36 truncate text-[13px] text-text">
          {entry.name}
        </span>
        <span className="w-20 truncate text-[12px] text-text-2">
          {entry.owner}
        </span>
        <span
          className="flex items-center gap-1.5"
          aria-label="telemetry presence"
        >
          {PILLARS.map(({ key, label }) => (
            <Tooltip
              key={key}
              content={`${label}: ${entry.telemetry[key] ? "present" : "absent"}`}
            >
              <span
                data-pillar={key}
                data-present={entry.telemetry[key] || undefined}
                className={clsx(
                  "size-2 rounded-full",
                  entry.telemetry[key] ? "bg-ok" : "bg-nodata/40",
                )}
              />
            </Tooltip>
          ))}
        </span>
        <span className="hidden flex-1 truncate text-[11px] text-text-2 md:block">
          {entry.environments.join(" · ")}
        </span>
      </button>
      <span className="flex shrink-0 items-center gap-2">
        {entry.links.repo && (
          <a
            href={entry.links.repo}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-[12px] text-text-2 hover:text-brand-text"
          >
            repo <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
        {entry.links.runbook && (
          <a
            href={entry.links.runbook}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-0.5 text-[12px] text-text-2 hover:text-brand-text"
          >
            runbook <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </span>
    </div>
  );
}
