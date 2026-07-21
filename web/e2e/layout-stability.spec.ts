import { expect, test, type Page } from "@playwright/test";

/**
 * Layout-stability LOCK (perf pass 2026-07-21). The audited dashboards
 * shipped CLS 0.23–0.31: the NavRail's 56→240px width entrance slid every
 * route's content column, the MI-14 IncidentBanner mounted above <main>
 * after first paint, and §8.1 loading frames didn't reserve their hydrated
 * sizes. All three are fixed (navRailInitScript pre-paint width, banner
 * slot reserve, `--widget-h-*` skeleton frames); this spec pins the
 * budget: web-vitals-style CLS < 0.1 on home and the audited dashboards.
 *
 * CLS is computed the way Chrome reports it — layout-shift entries
 * without recent input, grouped into session windows (≤5s span, ≤1s
 * gaps), taking the worst window.
 */

const BUDGET = 0.1;

interface ShiftEntry {
  value: number;
  ts: number;
  sources: string[];
}

declare global {
  interface Window {
    __shifts?: ShiftEntry[];
  }
}

test.beforeEach(async ({ page, request }) => {
  // hermetic seed — earlier specs mutate the shared narrative
  await request.post("/api/mock/v1/reset");
  await page.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
          sources?: { node: Node | null }[];
        };
        if (shift.hadRecentInput) continue;
        window.__shifts?.push({
          value: shift.value,
          ts: entry.startTime,
          sources: (shift.sources ?? []).map((source) => {
            const node = source.node;
            const el =
              node && node.nodeType === 1
                ? (node as Element)
                : (node?.parentElement ?? null);
            if (!el) return node?.nodeName ?? "?";
            const testId = el.getAttribute("data-testid");
            return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${
              testId ? `[${testId}]` : ""
            }`;
          }),
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
});

/** Worst session window (5s span / 1s gap) — the CWV CLS definition. */
async function windowedCls(page: Page): Promise<{
  cls: number;
  worst: ShiftEntry[];
}> {
  return page.evaluate(() => {
    const shifts = (window.__shifts ?? []).sort((a, b) => a.ts - b.ts);
    let max = 0;
    let current = 0;
    let windowStart = 0;
    let last = 0;
    for (const s of shifts) {
      if (current > 0 && s.ts - last <= 1000 && s.ts - windowStart <= 5000) {
        current += s.value;
      } else {
        current = s.value;
        windowStart = s.ts;
      }
      last = s.ts;
      if (current > max) max = current;
    }
    return {
      cls: max,
      worst: shifts.sort((a, b) => b.value - a.value).slice(0, 5),
    };
  });
}

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard**");
}

async function assertStable(page: Page, route: string, settle: string) {
  await page.goto(route);
  await expect(page.getByTestId(settle)).toBeVisible();
  // hold past hydration + data swaps — late shifts are the regression class
  await page.waitForTimeout(3_000);
  const { cls, worst } = await windowedCls(page);
  expect(
    cls,
    `${route} CLS ${cls.toFixed(3)} must stay under ${BUDGET}; worst shifts: ${JSON.stringify(worst)}`,
  ).toBeLessThan(BUDGET);
}

test("home stays layout-stable on load (CLS < 0.1)", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /All your telemetry\./ }),
  ).toBeVisible();
  await page.waitForTimeout(3_000);
  const { cls, worst } = await windowedCls(page);
  expect(
    cls,
    `home CLS ${cls.toFixed(3)}; worst shifts: ${JSON.stringify(worst)}`,
  ).toBeLessThan(BUDGET);
});

test("audited dashboards stay layout-stable on load (CLS < 0.1)", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page);
  await assertStable(page, "/dashboard", "dashboard-home");
  await assertStable(page, "/dashboard/monitors", "monitors-page");
  await assertStable(page, "/dashboard/metrics", "metrics-explorer");
});
