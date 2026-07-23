import { expect, test, type Page } from "@playwright/test";

/**
 * Wave B surfaces (pages.md [Designed 2026-07-20]):
 *  - B7 synthetics: seeded failing run + builder CRUD round-trip + Run once
 *  - B7 status-page builder → the public /status/{slug} page reflects it
 *  - B4 log patterns tab: clusters render, expand shows sample lines
 *  - B12 usage metering: the rendered meters are the API's own honest sums
 *  - B6 RUM drill-down: funnel + weekly cohort retention + top lists
 *
 * Shared mutable mock narrative — serial by design (playwright.config).
 */
test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard**");
}

async function reset(page: Page) {
  await page.request.post("/api/mock/v1/testing/reset");
}

/* ------------------------------------------------------------------ */
/* B7 synthetics                                                        */
/* ------------------------------------------------------------------ */

test("B7: seeded multi-step check — failing run #482 stops at first failure", async ({
  page,
}) => {
  await reset(page);
  await signIn(page);

  await page.goto("/dashboard/uptime");
  const row = page.getByTestId("synthetic-syn_checkout");
  await expect(row).toBeVisible();
  await expect(row).toContainText("checkout flow — api + web");
  await expect(row).toContainText("MULTI-STEP");
  await row.click();
  await page.waitForURL("**/dashboard/uptime/checks/syn_checkout**");
  await expect(page.getByTestId("synthetic-run")).toBeVisible();

  // latest run passed (INC-42 is mitigated) — run history carries the fail
  await expect(page.getByText("PASS").first()).toBeVisible();
  await page
    .getByRole("list", { name: "Run history" })
    .getByText("#482")
    .click();
  await expect(page.getByText("stopped at first failure")).toBeVisible();

  // three executed steps; the third FAILs; 4–5 never ran
  const steps = page.getByRole("list", { name: "Step results" });
  await expect(steps.locator("[data-result]")).toHaveCount(3);
  await expect(steps.locator('[data-result="fail"]')).toHaveCount(1);
  await expect(steps.getByText("assert body.ok == true")).toBeVisible();
  await expect(
    page.getByText("Steps 4–5 not run — the check stops at the first failure."),
  ).toBeVisible();

  // failure-screenshot card (browser stage, screenshot-on-failure ON)
  const screenshot = page.getByTestId("failure-screenshot");
  await expect(screenshot).toBeVisible();
  await expect(screenshot).toContainText(
    "Failure screenshot — step 3 · viewport 1440 × 900",
  );

  // UptimeCard context — the monitor watching the first step's host
  await expect(page.getByLabel("API health uptime context")).toBeVisible();
});

test("B7: builder CRUD round-trip — create, run once, edit, delete", async ({
  page,
}) => {
  await reset(page);
  await signIn(page);

  await page.goto("/dashboard/uptime");
  await page.getByTestId("new-check").click();
  await page.waitForURL("**/dashboard/uptime/new**");
  await expect(page.getByTestId("synthetic-builder")).toBeVisible();

  // Multi-step is the default tab; compose name + two steps
  await page.getByTestId("synthetic-name").fill("api journey e2e");
  await page.getByTestId("step-url").fill("https://api.cuesoft.io/health");
  await page.getByTestId("add-step").click();
  await page.getByRole("combobox", { name: "Step kind" }).click();
  await page.getByRole("option", { name: "Assertion" }).click();
  await page.getByTestId("step-expression").fill("status == 200");
  await page.getByTestId("add-step").click();
  await expect(
    page.getByRole("list", { name: "Check steps" }).locator("[data-kind]"),
  ).toHaveCount(2);

  // browser-check panel: URL + viewport + screenshot-on-failure
  await page.getByTestId("browser-url").fill("https://upstat.cuesoft.io/");

  // Run once — saves, executes, lands on the run view with per-step PASSes
  await page.getByTestId("run-once").click();
  await page.waitForURL("**/dashboard/uptime/checks/*?run=*");
  await expect(page.getByTestId("synthetic-run")).toBeVisible();
  await expect(page.getByText("api journey e2e · run #1")).toBeVisible();
  const steps = page.getByRole("list", { name: "Step results" });
  await expect(steps.locator('[data-result="pass"]')).toHaveCount(2);

  // edit: rename + verify the list reflects it
  await page.getByTestId("edit-check").click();
  await page.waitForURL("**/edit");
  await page.getByTestId("synthetic-name").fill("api journey e2e renamed");
  await page.getByTestId("save-check").click();
  await page.waitForURL("**/dashboard/uptime");
  await expect(page.getByText("api journey e2e renamed")).toBeVisible();

  // delete: the check leaves the list
  await page.getByText("api journey e2e renamed").click();
  await page.waitForURL("**/dashboard/uptime/checks/*");
  await page.getByTestId("edit-check").click();
  await page.waitForURL("**/edit");
  await page.getByTestId("delete-check").click();
  await page.waitForURL("**/dashboard/uptime");
  await expect(page.getByText("api journey e2e renamed")).toHaveCount(0);
});

/* ------------------------------------------------------------------ */
/* B7 status-page builder                                               */
/* ------------------------------------------------------------------ */

test("B7: status-page builder edits reflect on the public page", async ({
  page,
}) => {
  await reset(page);
  await signIn(page);

  // reachable from the settings Integrations tab (routed tabs,
  // 2026-07-20); the builder itself stays a focused sub-screen
  await page.goto("/dashboard/settings/integrations");
  await page.getByTestId("open-status-page-builder").click();
  await page.waitForURL("**/dashboard/settings/status-page");
  await expect(page.getByTestId("status-page-builder")).toBeVisible();

  // rename the first component and push it one row down (keyboard grip)
  const firstName = page.getByLabel("Component name").first();
  await expect(firstName).toHaveValue("Homepage");
  await firstName.fill("Web frontend");
  await page
    .getByRole("button", { name: "Reorder Web frontend" })
    .press("ArrowDown");
  await page.getByTestId("save-status-page").click();
  // exact: the settings copy ("Saved changes publish immediately…")
  // substring-matches a bare "Saved" and trips strict mode.
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // public-URL preview links the slugged public construction
  await expect(page.getByTestId("open-public-page")).toHaveAttribute(
    "href",
    "/status/upstat",
  );

  // the public page renders builder names in builder order
  await page.goto("/status/upstat");
  await expect(page.getByTestId("status-page")).toBeVisible();
  const components = page.getByRole("list", { name: "Components" });
  await expect(components.getByText("Web frontend")).toBeVisible();
  const names = await components
    .locator("li")
    .evaluateAll((items) => items.map((li) => li.textContent ?? ""));
  expect(names[0]).toContain("API health"); // moved above the renamed row
  expect(names[1]).toContain("Web frontend");
});

/* ------------------------------------------------------------------ */
/* B4 log patterns                                                      */
/* ------------------------------------------------------------------ */

test("B4: patterns tab clusters the range; rows expand to sample lines", async ({
  page,
}) => {
  await reset(page);
  await signIn(page);

  await page.goto("/dashboard/logs?range=1h&tab=patterns");
  await expect(page.getByTestId("patterns-panel")).toBeVisible();
  const rows = page
    .getByRole("list", { name: "Log patterns" })
    .getByRole("button");
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(3);

  // clustered variables read as <placeholders>; footer states the math
  await expect(
    page.getByText("<placeholders> mark the clustered variables."),
  ).toBeVisible();
  await expect(page.getByText(/lines into \d+ templates/)).toBeVisible();

  // expand → indented sample LogLines matching the stream's shape
  await rows.first().click();
  const samples = page.getByRole("list", { name: "Sample lines" });
  await expect(samples.locator("[data-level]").first()).toBeVisible();

  // the tab bar swaps back to the stream
  await page.getByTestId("logs-tab-logs").click();
  await expect(page.getByTestId("log-list")).toBeVisible();
});

/* ------------------------------------------------------------------ */
/* B12 usage metering                                                   */
/* ------------------------------------------------------------------ */

test("B12: usage meters render the API's own honest sums, plan verbatim", async ({
  page,
}) => {
  await reset(page);
  await signIn(page);

  const report = await (await page.request.get("/api/mock/v1/usage")).json();
  expect(report.rows).toHaveLength(4);

  await page.goto("/dashboard/settings/usage");
  await expect(page.getByTestId("settings-usage")).toBeVisible();
  await expect(
    page.getByText(`Month-to-date usage — ${report.month_label}`),
  ).toBeVisible();

  const meters = page.getByRole("list", { name: "Usage meters" });
  for (const row of report.rows) {
    const meterRow = meters.locator(`[data-pillar="${row.pillar}"]`);
    await expect(meterRow).toContainText(row.label);
    await expect(meterRow).toContainText(row.display); // the computed sum
    // accuracy canon: the plan column is verbatim
    await expect(meterRow).toContainText(
      "Self-host: unlimited · Cloud: announced at GA",
    );
  }
});

/* ------------------------------------------------------------------ */
/* B6 RUM drill-down                                                    */
/* ------------------------------------------------------------------ */

test("B6: drill-down renders funnel, honest conversion label, cohorts, top lists", async ({
  page,
}) => {
  await reset(page);
  await signIn(page);

  // routed from the RUM pillar
  await page.goto("/dashboard/rum");
  await page.getByTestId("open-drilldown").click();
  await page.waitForURL("**/dashboard/rum/drilldown");
  await expect(page.getByTestId("rum-drilldown")).toBeVisible();

  // funnel — three narrowing stages with share-of-previous meta
  const funnel = page.getByLabel("Conversion funnel");
  await expect(funnel.getByText("Page views")).toBeVisible();
  await expect(funnel.getByText("Sessions")).toBeVisible();
  await expect(funnel.getByText("Conversions — signup")).toBeVisible();
  await expect(funnel.getByText(/% of previous stage/).first()).toBeVisible();
  // the conversion definition is labeled honestly in-page
  await expect(funnel.getByText("auth_signin_completed")).toBeVisible();

  // weekly cohort retention grid (Heatmap re-axised to cohort weeks)
  await expect(page.getByText("Retention — weekly cohorts")).toBeVisible();
  await expect(page.getByText("cohort week 0–6 · % returning")).toBeVisible();
  await expect(page.getByText("wk 0")).toBeVisible();
  await expect(page.getByText("wk 6")).toBeVisible();

  // top pages / referrers TopLists share the summary read
  await expect(page.getByText("/pricing")).toBeVisible();
  await expect(page.getByText("google.com")).toBeVisible();
});
