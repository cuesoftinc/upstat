"use client";

import Link from "next/link";
import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { ServiceMapNode } from "@/components/ui/ServiceMapNode";
import { useServiceMapController, type MapEdge } from "@/controllers/service-map";
import { PageTabs } from "../../page-tabs";
import { apmTabs } from "../apm-tabs";

const W = 1100;
const H = 560;
const NODE_HALF = 75; // ServiceMapNode is 150px wide

function fmtReq(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
}

function edgeLabel(edge: MapEdge): string {
  return `${fmtReq(edge.reqPerS)} req/s · ${(edge.errorRate * 100).toFixed(1)}% err · p95 ${Math.round(edge.p95Ms)}ms`;
}

/**
 * B5 service map (Figma 129:1979) — hexagon nodes (error ring), dashed
 * edges with throughput/error/latency tooltips; an erroring edge tints
 * crit. Bespoke SVG + deterministic radial layout (reuse policy §1).
 */
export default function ServiceMapPage() {
  const { services, nodes, edges } = useServiceMapController();
  const [selected, setSelected] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("service"),
  );
  const [hoverEdge, setHoverEdge] = useState<MapEdge | null>(null);

  const nodeAt = (name: string) => nodes.find((n) => n.stats.service === name);

  return (
    <div className="flex flex-col gap-4 px-6 py-5" data-testid="service-map">
      <header className="flex items-center gap-6">
        <h1 className="text-[20px] font-semibold">Service map</h1>
        <PageTabs label="APM views" tabs={apmTabs("map")} />
        {selected && (
          <p className="ml-auto text-[12px] text-text-2">
            highlight: <span className="font-data text-text">{selected}</span> —{" "}
            <Link href={`/dashboard/traces/services/${selected}`} className="text-brand hover:underline">
              open service →
            </Link>
          </p>
        )}
      </header>

      {services.loading ? (
        <Skeleton kind="panel-axis" style={{ height: H }} />
      ) : nodes.length === 0 ? (
        <section
          aria-label="Empty service map"
          className="rounded-(--radius) border border-border bg-bg-elev p-10 text-center text-[13px] text-text-2"
        >
          The map draws itself from traces — instrument two services and
          their edge appears here.
        </section>
      ) : (
        <section aria-label="Service topology" className="relative" style={{ height: H }}>
          {/* edges */}
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
          >
            {edges.map((edge) => {
              const a = nodeAt(edge.from);
              const b = nodeAt(edge.to);
              if (!a || !b) return null;
              const involved =
                selected !== null && (edge.from === selected || edge.to === selected);
              return (
                <line
                  key={`${edge.from}-${edge.to}`}
                  x1={a.x * W}
                  y1={a.y * H}
                  x2={b.x * W}
                  y2={b.y * H}
                  stroke={edge.erroring ? "var(--color-crit)" : "var(--color-border)"}
                  strokeWidth={involved ? 2 : 1.25}
                  strokeDasharray="4 4"
                  opacity={selected === null || involved ? 1 : 0.35}
                />
              );
            })}
          </svg>

          {/* edge hit areas + tooltip */}
          {edges.map((edge) => {
            const a = nodeAt(edge.from);
            const b = nodeAt(edge.to);
            if (!a || !b) return null;
            const mx = ((a.x + b.x) / 2) * 100;
            const my = ((a.y + b.y) / 2) * 100;
            return (
              <button
                key={`hit-${edge.from}-${edge.to}`}
                type="button"
                aria-label={`${edge.from} → ${edge.to}: ${edgeLabel(edge)}`}
                onMouseEnter={() => setHoverEdge(edge)}
                onMouseLeave={() => setHoverEdge(null)}
                onFocus={() => setHoverEdge(edge)}
                onBlur={() => setHoverEdge(null)}
                className="absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${mx}%`, top: `${my}%` }}
              />
            );
          })}

          {hoverEdge && (
            <div
              role="status"
              data-testid="edge-tooltip"
              className="absolute z-[var(--z-dropdown)] -translate-x-1/2 rounded-(--radius) border border-border bg-bg-elev px-3 py-2 shadow-lg"
              style={{
                left: `${(((nodeAt(hoverEdge.from)?.x ?? 0) + (nodeAt(hoverEdge.to)?.x ?? 0)) / 2) * 100}%`,
                top: `calc(${(((nodeAt(hoverEdge.from)?.y ?? 0) + (nodeAt(hoverEdge.to)?.y ?? 0)) / 2) * 100}% + 16px)`,
              }}
            >
              <p className="font-data text-[11px] text-text-2">
                {hoverEdge.from} → {hoverEdge.to}
              </p>
              <p className="font-data text-[12px] tabular-nums text-text">{edgeLabel(hoverEdge)}</p>
            </div>
          )}

          {/* nodes */}
          <ul aria-label="Services">
            {nodes.map((node, i) => (
              <li
                key={node.stats.service}
                className="absolute"
                style={{
                  left: `calc(${node.x * 100}% - ${NODE_HALF}px)`,
                  top: `calc(${node.y * 100}% - ${NODE_HALF}px)`,
                }}
              >
                <ServiceMapNode
                  name={node.stats.service}
                  reqPerS={node.stats.req_per_s}
                  errorRate={node.stats.error_rate}
                  colorIndex={i}
                  selected={selected === node.stats.service}
                  onClick={() =>
                    setSelected((cur) => (cur === node.stats.service ? null : node.stats.service))
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
