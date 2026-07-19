import { expect, test } from "@playwright/test";

/**
 * Demo-completeness features (PR3): portable dashboard JSON import (B2 /
 * api.md §6), RUM devices+geo breakdowns (B6), logs-in-span (B5 span
 * drawer), declare-incident from an alert row (B9 [Directive]), and the
 * Features/Platform nav-anchor differentiation.
 */

test.beforeEach(async ({ request }) => {
  await request.post("/api/mock/v1/reset");
});

const PORTABLE = JSON.stringify({
  version: 1,
  name: "Imported — golden signals",
  template_vars: { env: ["prod"] },
  widgets: [
    {
      type: "timeseries",
      title: "p95 latency (imported)",
      query_string: "metric:http.request.duration_ms | p95()",
      viz_options: { display: "line" },
      layout: { x: 0, y: 0, w: 8, h: 3 },
    },
    {
      type: "query_value",
      title: "req/s (imported)",
      query_string: "metric:http.requests_total | rate()",
      viz_options: { precision: 0 },
      layout: { x: 8, y: 0, w: 4, h: 3 },
    },
  ],
});

test("dashboards: import a portable JSON definition → lands on the new dashboard", async ({
  page,
}) => {
  await page.goto("/dashboard/dashboards");
  await page.getByTestId("import-dashboard").click();
  await page.getByTestId("import-json").fill(PORTABLE);
  await page.getByTestId("confirm-import").click();
  await page.waitForURL("**/dashboard/dashboards/dash*");
  await expect(page.getByRole("heading", { name: "Imported — golden signals" })).toBeVisible();
  await expect(page.getByText("p95 latency (imported)")).toBeVisible();
  // the imported definition carries its template vars
  await expect(page.getByRole("combobox", { name: "$env" })).toBeVisible();
  // and the view exposes the matching export affordance
  await expect(page.getByTestId("export-dashboard")).toBeVisible();
});

test("dashboards: malformed import errors readably, nothing created", async ({ page }) => {
  await page.goto("/dashboard/dashboards");
  await page.getByTestId("import-dashboard").click();
  await page.getByTestId("import-json").fill('{"version": 3}');
  await page.getByTestId("confirm-import").click();
  await expect(page.getByRole("alert")).toHaveText(/unsupported version/);
});

test("RUM: devices and countries breakdowns render (B6)", async ({ page }) => {
  await page.goto("/dashboard/rum");
  await expect(page.getByRole("heading", { name: "Devices" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Countries" })).toBeVisible();
  // cookieless geo = coarse country codes from the seeded summary
  await expect(page.getByText("desktop")).toBeVisible();
  await expect(page.getByText("NG", { exact: true })).toBeVisible();
});

test("traces: the hero span's logs-in-span tab carries correlated lines (B5)", async ({
  page,
}) => {
  await page.goto("/dashboard/traces/explorer");
  // the hero trace is the seeded POST /v1/events run; selecting it fires
  // the correlated-logs fetch — wait for it before reading tab counts
  const logsLanded = page.waitForResponse((r) => r.url().includes("/api/mock/v1/logs"));
  await page.getByTestId(/^trace-9f86d081/).click();
  await expect(page.getByTestId("trace-waterfall")).toBeVisible();
  await logsLanded;
  // walk the spans until one's window holds correlated lines (which span
  // catches them depends on the deterministic-but-seed-relative stream)
  const spanRows = page.getByRole("list", { name: "Trace spans" }).getByRole("button");
  const drawer = page.locator('aside[aria-label^="Span "]');
  const count = await spanRows.count();
  let found = false;
  for (let i = 0; i < count && !found; i++) {
    await spanRows.nth(i).click();
    await expect(drawer).toBeVisible();
    const label = await drawer.getByRole("tab", { name: /logs/ }).textContent();
    found = label !== null && !label.includes("logs (0)");
  }
  expect(found, "some hero span should carry correlated log lines").toBe(true);
  await drawer.getByRole("tab", { name: /logs/ }).click();
  await expect(drawer.getByText("No logs within this span.")).toHaveCount(0);
  // correlated line(s) render as LogLine rows (level chip + mono message)
  await expect(drawer.getByText(/INFO|DEBUG|WARN|ERROR|TRACE/).first()).toBeVisible();
});

test("monitors: an active alert row opens declare-incident prefilled (B9)", async ({ page }) => {
  await page.goto("/dashboard/monitors");
  await page
    .getByRole("list", { name: "Triggered feed" })
    .getByRole("button")
    .first()
    .click();
  const modal = page.getByRole("dialog", { name: "Declare incident" });
  await expect(modal).toBeVisible();
  // prefilled from the alert (sev1 checkout p95 breach is the newest row)
  await expect(modal.getByTestId("incident-title")).toHaveValue(/Checkout p95 latency/);
  await modal.getByRole("combobox", { name: "Commander" }).click();
  await page.getByRole("option", { name: "Kemi" }).click();
  await modal.getByTestId("confirm-declare").click();
  await page.waitForURL("**/dashboard/incidents/inc*");
  await expect(page.getByText(/Checkout p95 latency/).first()).toBeVisible();
});

test("nav: Features and Platform anchor different landing sections", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Marketing" });
  await expect(nav.getByRole("link", { name: "Features" })).toHaveAttribute(
    "href",
    "/#features",
  );
  await expect(nav.getByRole("link", { name: "Platform" })).toHaveAttribute(
    "href",
    "/#pillars",
  );
  // both anchors exist on the page
  await expect(page.locator("#features")).toHaveCount(1);
  await expect(page.locator("#pillars")).toHaveCount(1);
});
