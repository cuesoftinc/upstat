"use client";

/**
 * /docs/api — public API reference (X-2). Marketing nav chrome over the
 * full-height Scalar embed, closed by a minimal legal strip (the full
 * A10 footer stays on `/`). Views render-only — nav data + handlers
 * come from the docs-api controller.
 */

import { MarketingNav } from "@/components/ui/MarketingNav";
import { useDocsApiController } from "@/controllers/home";
import { ScalarApiReference } from "./ScalarApiReference";

const LICENSE_URL = "https://github.com/cuesoftinc/upstat/blob/main/LICENSE";

export function DocsApiView() {
  const { stars, onSignIn, onTryCloud } = useDocsApiController();

  return (
    <div className="font-ui flex min-h-screen flex-col bg-bg text-text">
      <MarketingNav
        starCount={stars}
        onSignIn={onSignIn}
        onTryCloud={onTryCloud}
      />
      {/* Header-fix construction (2026-07-20): the sticky marketing nav
          (h-14 + border = 57px) and Scalar's own sticky layout coexist by
          telling Scalar about the header — `--scalar-custom-header-height`
          offsets its sticky sidebar/mobile bar below the nav and shrinks
          its viewport math to match (one coherent scroll). `isolate` opens
          a stacking context so no Scalar z-index can paint over the nav. */}
      <main className="isolate flex-1 [--scalar-custom-header-height:57px]">
        <ScalarApiReference />
      </main>
      {/* Minimal footer strip — verbatim legal line only (parity canon). */}
      <footer className="border-t border-border bg-bg px-6 py-4">
        <p className="mx-auto max-w-[1152px] text-[12px] text-text-2">
          ©{" "}
          <a
            href="https://cuesoft.io"
            className="transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            Cuesoft Inc.
          </a>{" "}
          2026. Upstat.{" "}
          <a
            href="https://cuelabs.cuesoft.io"
            className="transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            CueLABS™ Division
          </a>
          .{" "}
          <a
            href={LICENSE_URL}
            className="transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            MIT License
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
