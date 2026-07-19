"use client";

import { useState } from "react";
import { APIKeyRow } from "@/components/ui/APIKeyRow";
import { Button } from "@/components/ui/Button";
import { CodeSnippet } from "@/components/ui/CodeSnippet";
import { Input } from "@/components/ui/Input";
import { useRumPropertyController } from "@/controllers/rum";

/**
 * B6 property create (Figma 175:6188) — site/domain → property-key
 * issuance + browser-SDK snippet; "verifying" resolves on the first
 * pageview (keys are managed in B12 settings/properties).
 */
export default function RumNewPropertyPage() {
  const ctrl = useRumPropertyController();
  const [domain, setDomain] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await ctrl.create(domain.trim());
  };

  const snippet = ctrl.created
    ? `<script async\n  src="https://rum.upstat.cuesoft.io/u.js"\n  data-property="${ctrl.created.key.slice(0, 12)}…">\n</script>`
    : "";

  return (
    <div className="flex flex-col gap-5 px-6 py-5" data-testid="rum-new-property">
      <h1 className="text-[20px] font-semibold">RUM — add property</h1>

      <section
        aria-labelledby="new-property-heading"
        className="rounded-(--radius) border border-border bg-bg-elev p-5"
      >
        <h2 id="new-property-heading" className="mb-4 text-[16px] font-semibold">
          New property
        </h2>

        {!ctrl.created ? (
          <form onSubmit={submit} className="flex max-w-md flex-col gap-4">
            <label className="flex flex-col gap-1 text-[13px]">
              <span className="text-text-2">Domain</span>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="app.example.com"
                required
                data-testid="property-domain"
              />
            </label>
            {ctrl.error && (
              <p role="alert" className="text-[13px] text-crit">
                {ctrl.error}
              </p>
            )}
            <Button type="submit" disabled={ctrl.creating || !domain.trim()} data-testid="create-property">
              {ctrl.creating ? "Creating…" : "Create property"}
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="mb-2 text-[13px] text-text-2">Property key</h3>
              <APIKeyRow apiKey={ctrl.created} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <div>
                <h3 className="mb-2 text-[13px] text-text-2">
                  Install snippet — paste before &lt;/head&gt;
                </h3>
                <CodeSnippet tabs={[{ label: "HTML", code: snippet }]} />
              </div>

              <div aria-live="polite" className="flex flex-col items-start gap-3">
                {ctrl.verified ? (
                  <>
                    <span
                      data-testid="property-verified"
                      className="inline-flex items-center gap-1.5 rounded-full bg-ok/15 px-2.5 py-1 text-[12px] text-ok"
                    >
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-ok" />
                      VERIFIED
                    </span>
                    <p className="text-[13px] leading-[1.45] text-text-2">
                      First pageview received from {ctrl.created.name}. Data is
                      flowing — head back to RUM.
                    </p>
                  </>
                ) : (
                  <>
                    <span
                      data-testid="property-verifying"
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg px-2.5 py-1 text-[12px] text-text-2"
                    >
                      <span aria-hidden="true" className="size-1.5 animate-pulse rounded-full bg-nodata motion-reduce:animate-none" />
                      verifying
                    </span>
                    <p className="text-[13px] leading-[1.45] text-text">
                      Waiting for the first pageview from {ctrl.created.name}…
                    </p>
                    <p className="text-[12px] leading-[1.45] text-text-2">
                      We re-check every 30 s. Leave this page open — the pill
                      flips green on the first event. No cookies are set;
                      visitor counts use a daily-rotating salt.
                    </p>
                    <Button kind="quiet" onClick={ctrl.recheck} data-testid="recheck-property">
                      Re-check now
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
