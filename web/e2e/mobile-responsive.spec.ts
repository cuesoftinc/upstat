import { expect, test, type Page, type TestInfo } from "@playwright/test";

/**
 * Mobile responsiveness sweep ([Directive 2026-07-19]): home, the public
 * status page and EVERY /dashboard/<area> route render inside the 390px
 * viewport — the document never side-scrolls, <main> never pans, and wide
 * visualizations/tables scroll inside their own horizontal-scroll
 * containers. Detail drawers become full-width sheets. 768 gets a sanity
 * pass. Screenshots land per route in both themes (test-results/).
 */

const MOBILE = { width: 390, height: 844 };
const TABLET = { width: 768, height: 1024 };

// Pinch-zoom stays available (2026-07-21 a11y audit blocker: the root
// viewport export shipped maximumScale:1 — axe meta-viewport on 18/18
// route-loads; siblings' viewport export is the fleet pattern).
test("viewport meta never disables pinch-zoom", async ({ page }) => {
  await page.goto("/");
  const content = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");
  expect(content).toContain("width=device-width");
  expect(content).not.toMatch(/maximum-scale/i);
  expect(content).not.toMatch(/user-scalable\s*=\s*(no|0)/i);
});

/** Every route in the web-implementation.md §4 route map (seeded ids §6). */
const ROUTES = [
  "/",
  "/signin",
  "/status/upstat",
  "/dashboard",
  "/dashboard/onboarding",
  "/dashboard/dashboards",
  "/dashboard/dashboards/dash_overview",
  "/dashboard/metrics",
  "/dashboard/metrics/summary",
  "/dashboard/logs",
  "/dashboard/traces",
  "/dashboard/traces/explorer",
  "/dashboard/traces/map",
  "/dashboard/traces/services/api-common",
  "/dashboard/rum",
  "/dashboard/rum/new",
  "/dashboard/uptime",
  "/dashboard/uptime/mon_homepage",
  "/dashboard/monitors",
  "/dashboard/monitors/new",
  "/dashboard/monitors/mon_api",
  "/dashboard/incidents",
  "/dashboard/incidents/inc_42",
  "/dashboard/slos",
  "/dashboard/services",
  // routed settings tabs (2026-07-20): the bar itself must h-scroll in
  // the viewport, and every pane reflows — sweep all seven tab routes.
  "/dashboard/settings/general",
  "/dashboard/settings/members",
  "/dashboard/settings/keys",
  "/dashboard/settings/integrations",
  "/dashboard/settings/retention",
  "/dashboard/settings/appearance",
  "/dashboard/settings/usage",
];

interface OverflowReport {
  vw: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
  mainPan: { scrollWidth: number; clientWidth: number } | null;
  offenders: string[];
}

/**
 * In-page audit: document scroll width, <main> pan, and elements that
 * extend past the viewport WITHOUT an overflow-x scroll container ancestor
 * (those are the sanctioned pattern for wide charts/tables/maps).
 */
function auditOverflow(): OverflowReport {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const out: OverflowReport = {
    vw,
    htmlScrollWidth: doc.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    mainPan: null,
    offenders: [],
  };
  const main = document.querySelector("main");
  if (main && main.scrollWidth > main.clientWidth + 1) {
    out.mainPan = {
      scrollWidth: main.scrollWidth,
      clientWidth: main.clientWidth,
    };
  }
  const hasHScrollAncestor = (el: Element): boolean => {
    let node = el.parentElement;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      if (
        (style.overflowX === "auto" || style.overflowX === "scroll") &&
        node.tagName !== "MAIN"
      ) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  };
  const describe = (el: Element): string => {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body && parts.length < 4) {
      let part = node.tagName.toLowerCase();
      if (node.id) part += `#${node.id}`;
      else if (typeof node.className === "string" && node.className) {
        part +=
          "." +
          node.className.split(/\s+/).filter(Boolean).slice(0, 3).join(".");
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(" > ");
  };
  const reported: Element[] = [];
  for (const el of document.querySelectorAll("body *")) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (rect.right <= vw + 1 && rect.left >= -1) continue;
    if (reported.some((a) => a.contains(el))) continue;
    if (hasHScrollAncestor(el)) continue;
    reported.push(el);
    out.offenders.push(
      `[${Math.round(rect.left)},${Math.round(rect.right)}] ${describe(el)}`,
    );
    if (out.offenders.length >= 8) break;
  }
  return out;
}

// The dashboard is session-gated (flows/auth.md §2); the public routes
// (`/`, `/signin`, `/status/*`) are audited signed OUT — a /signin visit
// with a session would reverse-guard to /dashboard — so the session is
// established lazily: one sign-in beat before a test's first gated route
// (ROUTES orders public first, so the signed-out sweep stays intact).
const sessioned = new WeakSet<Page>();

async function ensureSession(page: Page, route: string) {
  if (!route.startsWith("/dashboard") || sessioned.has(page)) return;
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard**");
  sessioned.add(page);
}

async function open(page: Page, route: string) {
  await ensureSession(page, route);
  await page.goto(route, { waitUntil: "domcontentloaded" });
  // charts/lists render client-side from the mock — give them a beat
  await page.waitForTimeout(1_200);
}

async function assertNoOverflow(page: Page, route: string) {
  const report = await page.evaluate(auditOverflow);
  expect(
    report.htmlScrollWidth,
    `${route}: document must not side-scroll`,
  ).toBeLessThanOrEqual(report.vw);
  expect(
    report.bodyScrollWidth,
    `${route}: body must not side-scroll`,
  ).toBeLessThanOrEqual(report.vw);
  expect(
    report.mainPan,
    `${route}: <main> must not pan horizontally`,
  ).toBeNull();
  expect(
    report.offenders,
    `${route}: wide elements must live inside horizontal-scroll containers`,
  ).toEqual([]);
}

// hermetic start — the dev-persistent store accumulates orgs/incidents from
// earlier specs; re-seed the §6 narrative so seeded ids resolve
test.beforeEach(async ({ request }) => {
  await request.post("/api/mock/v1/reset");
});

function slug(route: string): string {
  return route === "/" ? "home" : route.slice(1).replace(/\//g, "-");
}

async function shoot(
  page: Page,
  testInfo: TestInfo,
  route: string,
  theme: "dark" | "light",
) {
  await page.screenshot({
    path: testInfo.outputPath(`${slug(route)}--${theme}.png`),
    fullPage: !route.startsWith("/dashboard"),
  });
}

test.describe("390 — every route fits the mobile viewport", () => {
  test("dark theme sweep + screenshots", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await page.setViewportSize(MOBILE);
    for (const route of ROUTES) {
      await open(page, route);
      await assertNoOverflow(page, route);
      await shoot(page, testInfo, route, "dark");
    }
  });

  test("light theme sweep + screenshots", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await page.addInitScript(() =>
      window.localStorage.setItem("upstat.theme", "light"),
    );
    await page.setViewportSize(MOBILE);
    for (const route of ROUTES) {
      await open(page, route);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await assertNoOverflow(page, route);
      await shoot(page, testInfo, route, "light");
    }
  });
});

test("768 — sanity sweep, no route side-scrolls", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize(TABLET);
  for (const route of ROUTES) {
    await open(page, route);
    await assertNoOverflow(page, route);
  }
});

// [Directive 2026-07-19] with the rail EXPANDED (240px), every dashboard
// route's content column must reflow cleanly at 1280 and 1440 — charts,
// tables, widget grids and filter bars adapt; nothing overflows.
test.describe("expanded rail — dashboard content reflows", () => {
  const DASH_ROUTES = ROUTES.filter((r) => r.startsWith("/dashboard"));

  for (const width of [1280, 1440]) {
    test(`${width} sweep with the rail expanded`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(240_000);
      await page.addInitScript(() =>
        window.localStorage.setItem("nav.rail.expanded", "1"),
      );
      await page.setViewportSize({ width, height: 900 });
      for (const route of DASH_ROUTES) {
        await open(page, route);
        await expect(
          page.getByRole("navigation", { name: "Product navigation" }),
        ).toHaveAttribute("data-expanded", "true");
        await assertNoOverflow(page, `${route} @${width} rail-expanded`);
      }
      // densest layouts, both rail states, for the visual record
      for (const route of [
        "/dashboard/dashboards/dash_overview",
        "/dashboard/logs",
      ]) {
        await open(page, route);
        await page.screenshot({
          path: testInfo.outputPath(`${slug(route)}--${width}-expanded.png`),
        });
        await page.getByTestId("rail-toggle").click();
        await page.waitForTimeout(350);
        await page.screenshot({
          path: testInfo.outputPath(`${slug(route)}--${width}-collapsed.png`),
        });
        // restore for the next route (the desktop toggle persists)
        await page.getByTestId("rail-toggle").click();
        await page.waitForTimeout(350);
      }
    });
  }
});

test("390 — span drawer opens as a full-width sheet inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await open(page, "/dashboard/traces/explorer");
  await page.locator('[data-testid^="trace-"]').first().click();
  await expect(page.getByTestId("trace-waterfall")).toBeVisible();
  const spanRow = page
    .getByRole("list", { name: "Trace spans" })
    .getByRole("button")
    .first();
  await spanRow.scrollIntoViewIfNeeded();
  await spanRow.click();
  const drawer = page.locator('aside[aria-label^="Span "]');
  await expect(drawer).toBeVisible();
  const box = (await drawer.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(MOBILE.width);
  expect(box.width).toBeGreaterThanOrEqual(MOBILE.width - 2); // full-width sheet
  await assertNoOverflow(page, "/dashboard/traces/explorer (drawer open)");
  await drawer.getByRole("button", { name: "Close span drawer" }).click();
  await expect(drawer).toBeHidden();
});

test("390 — the 12-col dashboard grid stacks; the widget editor fits", async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await open(page, "/dashboard/dashboards/dash_overview?edit=1");
  // stacked: every widget starts on the same left edge
  const lefts = await page.evaluate(() =>
    [...document.querySelectorAll("[data-widget-id]")].map((el) =>
      Math.round(el.getBoundingClientRect().x),
    ),
  );
  expect(lefts.length).toBeGreaterThan(1);
  expect(new Set(lefts).size, "widgets must stack single-column at 390").toBe(
    1,
  );
  // the lg widget-editor modal clamps to the viewport
  await page.getByTestId("add-widget").click();
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  const box = (await modal.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(MOBILE.width);
  await assertNoOverflow(
    page,
    "/dashboard/dashboards/dash_overview (editor open)",
  );
});

test("390 — expanding a log line keeps the document inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize(MOBILE);
  await open(page, "/dashboard/logs");
  const line = page
    .getByRole("list", { name: "Log lines" })
    .locator("li button")
    .first();
  await expect(line).toBeVisible({ timeout: 15_000 }); // live tail flushes in batches
  await line.scrollIntoViewIfNeeded();
  await line.click();
  await assertNoOverflow(page, "/dashboard/logs (line expanded)");
});
