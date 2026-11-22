"use client";

/**
 * Dev-only component gallery — every W1 registry component in all variants,
 * dark (product default) first, then the same registry under the light
 * token mode. Unlinked route; exists for the Figma-match QA loop
 * (web-implementation.md §2 W1 "closes when" criteria).
 */

import { ControlDemos } from "./gallery-controls";
import { OperationsDemos } from "./gallery-operations";
import { TelemetryDemos } from "./gallery-telemetry";
import { ChromeDemos } from "./gallery-chrome";
import { MarketingDemos } from "./gallery-marketing";

function GalleryAll() {
  return (
    <div className="flex flex-col gap-[var(--space-8)] bg-bg p-[var(--space-6)] text-text">
      <ControlDemos />
      <OperationsDemos />
      <TelemetryDemos />
      <ChromeDemos />
      <MarketingDemos />
    </div>
  );
}

export function ComponentGallery() {
  return (
    <div className="font-ui min-h-screen bg-bg text-text">
      <header className="border-b border-border bg-bg-elev px-[var(--space-6)] py-[var(--space-4)]">
        <h1 className="text-[20px] font-semibold">W1 component gallery</h1>
        <p className="text-[13px] leading-[1.45] text-text-2">
          Dev-only QA surface — every Figma registry component, all variants.
          Dark (product default) first; the identical registry renders under the
          light token mode below.
        </p>
      </header>

      {/* Semantic landmark: the gallery body is the page's single <main>
          (live-QA sweep: this page had zero). Component instances inside
          keep their own semantics — StatusPageHeader demos legitimately
          render <h1>, so this dev-only page has extra h1s by design.
          id + tabIndex: the SkipLink (root layout) targets #main. */}
      <main id="main" tabIndex={-1}>
        <GalleryAll />

        <div data-theme="light">
          <div className="border-y border-border bg-bg-elev px-[var(--space-6)] py-[var(--space-3)]">
            <h2 className="text-[16px] font-semibold text-text">Light mode</h2>
          </div>
          <GalleryAll />
        </div>
      </main>
    </div>
  );
}
