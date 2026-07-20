"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BufferedCountChip } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FacetGroup } from "@/components/ui/FacetGroup";
import { LogHistogram } from "@/components/ui/LogHistogram";
import { LOG_LINE_ROW_PX, LogLine } from "@/components/ui/LogLine";
import { QueryBar } from "@/components/ui/QueryBar";
import { SavedViewChip } from "@/components/ui/SavedViewChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLogLineKeys, useLogsExplorerController } from "@/controllers/logs";
import {
  computeVirtualWindow,
  type WindowExtra,
} from "@/controllers/virtual-window";

/** Pre-measurement estimate for an expanded row (corrected on paint). */
const EXPANDED_FALLBACK_PX = 180;

/**
 * B4 logs explorer (Figma 128:1236) — FacetSidebar + QueryBar + LogLine
 * list + histogram header (MI-6); live tail with PAUSED pill + buffered
 * count (MI-4); expandable JSON with the ⌘click pivot (MI-5).
 */
export default function LogsPage() {
  const ctrl = useLogsExplorerController();
  const listRef = useRef<HTMLDivElement>(null);
  // §5: j/k walk the log lines; Enter expands (MI-17 cheatsheet rows)
  useLogLineKeys(listRef);

  const facets = ctrl.base.data?.facets ?? {};
  const histogram = ctrl.base.data?.histogram ?? [];

  // display ascending (oldest → newest); the tail pins to the bottom
  const ascending = useMemo(() => [...ctrl.events].reverse(), [ctrl.events]);

  /* ---- B4 windowing (bespoke, controllers/virtual-window) — spacers keep
     scrollHeight truthful so the MI-4 pause/buffer semantics are untouched */
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(480);
  // MI-5 expansion is lifted here: windowed-out rows unmount, so the list
  // owns the expanded set and each expanded row's measured height
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  // measured heights of expanded rows — state (not a ref): it is read
  // during render for the spacer math (react-hooks/refs)
  const [measured, setMeasured] = useState<ReadonlyMap<string, number>>(
    () => new Map(),
  );

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    setViewportH(el.clientHeight);
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const extras = useMemo<WindowExtra[]>(() => {
    if (expandedIds.size === 0) return [];
    const list: WindowExtra[] = [];
    ascending.forEach((event, index) => {
      if (!expandedIds.has(event.id)) return;
      const px = measured.get(event.id) ?? EXPANDED_FALLBACK_PX;
      list.push({ index, extra: Math.max(0, px - LOG_LINE_ROW_PX) });
    });
    return list;
  }, [ascending, expandedIds, measured]);

  const win = computeVirtualWindow({
    count: ascending.length,
    rowHeight: LOG_LINE_ROW_PX,
    viewportHeight: viewportH,
    scrollTop,
    extras,
  });

  // MI-4: auto-scroll while live and not paused
  useEffect(() => {
    if (!ctrl.live || ctrl.paused) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [ascending.length, ctrl.live, ctrl.paused]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    setScrollTop(el.scrollTop);
    if (!ctrl.live) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 48;
    if (!atBottom && !ctrl.paused) ctrl.pause();
  };

  const resume = () => {
    ctrl.resume();
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({
        top: listRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  };

  const empty = !ctrl.base.loading && ascending.length === 0;

  return (
    <div
      className="flex h-full min-h-0 flex-col gap-4 px-6 py-5"
      data-testid="logs-explorer"
    >
      <h1 className="text-[20px] font-semibold">Logs</h1>

      {(ctrl.views.data ?? []).length > 0 && (
        <ul
          aria-label="Saved views"
          className="flex flex-wrap items-center gap-2"
        >
          {(ctrl.views.data ?? []).map((view) => (
            <li key={view.id}>
              <SavedViewChip
                name={view.name}
                sharedWith={view.scope === "org" ? view.shared_with : undefined}
                onClick={() => ctrl.applyView(view.query)}
              />
            </li>
          ))}
        </ul>
      )}

      <QueryBar
        pills={ctrl.queryState.pills}
        onRemovePill={ctrl.removePill}
        text={ctrl.queryState.text}
        onTextChange={ctrl.queryState.setText}
        onSubmit={ctrl.submit}
        placeholder="service:api-common level:ERROR free text…"
      />

      {/* facets stack above the stream below lg (390 support) */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row">
        {/* FacetSidebar (MI-6) */}
        <aside
          aria-label="Facets"
          className="w-full shrink-0 lg:w-52 lg:overflow-y-auto"
        >
          {(["service", "level", "host"] as const).map((facet) => (
            <FacetGroup
              key={facet}
              name={facet}
              values={facets[facet] ?? []}
              selected={ctrl.selectedFacets[facet] ?? []}
              onToggle={(value) => ctrl.toggleFacet(facet, value)}
              defaultExpanded={facet === "service"}
              topN={5}
            />
          ))}
        </aside>

        <section
          aria-label="Log stream"
          className="flex min-w-0 flex-1 flex-col gap-3"
        >
          <header className="flex flex-wrap items-start gap-4">
            <div className="w-96 min-w-0 max-w-full rounded-(--radius) border border-border bg-bg-elev p-3">
              {/* LogHistogram renders its own totals header (events · error · warn) */}
              {ctrl.base.loading ? (
                <Skeleton kind="panel-axis" style={{ height: 64 }} />
              ) : (
                <LogHistogram buckets={histogram} />
              )}
            </div>
            {ctrl.live && ctrl.paused && (
              <span
                data-testid="paused-pill"
                className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-elev px-2.5 py-1 text-[12px] text-text-2"
              >
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-nodata"
                />
                PAUSED
              </span>
            )}
            {ctrl.live && ctrl.bufferedCount > 0 && (
              <BufferedCountChip
                count={ctrl.bufferedCount}
                onClick={resume}
                className="mt-1"
              />
            )}
          </header>

          <div
            ref={listRef}
            onScroll={onScroll}
            data-testid="log-list"
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {ctrl.base.loading && !ctrl.live ? (
              <div className="flex flex-col gap-1">
                {Array.from({ length: 10 }, (_, i) => (
                  <Skeleton key={i} kind="line" />
                ))}
              </div>
            ) : empty ? (
              <EmptyState pillar="logs" waiting={ctrl.live} />
            ) : (
              <ul aria-label="Log lines" data-testid="log-lines">
                {win.padTop > 0 && (
                  <li
                    aria-hidden="true"
                    data-testid="log-spacer-top"
                    style={{ height: win.padTop }}
                  />
                )}
                {ascending.slice(win.start, win.end).map((event) => {
                  const expanded = expandedIds.has(event.id);
                  return (
                    <li
                      key={event.id}
                      // measure expanded rows for exact spacer math (an
                      // off-screen expanded row keeps its last measurement)
                      ref={
                        expanded
                          ? (el) => {
                              if (!el) return;
                              const px = el.offsetHeight;
                              setMeasured((prev) =>
                                prev.get(event.id) === px
                                  ? prev
                                  : new Map(prev).set(event.id, px),
                              );
                            }
                          : undefined
                      }
                    >
                      <LogLine
                        event={event}
                        onPivot={ctrl.pivot}
                        expanded={expanded}
                        onExpandedChange={(next) =>
                          setExpandedIds((prev) => {
                            const set = new Set(prev);
                            if (next) set.add(event.id);
                            else set.delete(event.id);
                            return set;
                          })
                        }
                      />
                    </li>
                  );
                })}
                {win.padBottom > 0 && (
                  <li
                    aria-hidden="true"
                    data-testid="log-spacer-bottom"
                    style={{ height: win.padBottom }}
                  />
                )}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
