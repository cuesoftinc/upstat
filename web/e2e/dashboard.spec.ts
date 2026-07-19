import { expect, test, type Page } from "@playwright/test";

/**
 * W3 §8.4 "Login" journey — TEST_MODE against the in-app mock server:
 * signin → onboarding (create-org → first-data) → B1 Home → dashboards
 * (create w/ widget picker) → metrics explorer drill → logs live tail →
 * trace waterfall → monitor create → incident declare → the public status
 * page reflecting the declared incident.
 *
 * The mock store is shared server state — the file runs serially and the
 * journey restores the primary org before it ends.
 */
test.describe.configure({ mode: "serial" });

/** Dev-mode compiles routes on demand — warm the heavy ones up front so
 *  in-journey navigations don't race cold compiles. */
async function prewarm(page: Page) {
  for (const path of [
    "/dashboard",
    "/dashboard/onboarding",
    "/dashboard/dashboards",
    "/dashboard/dashboards/dash_overview",
    "/dashboard/metrics",
    "/dashboard/logs",
    "/dashboard/traces",
    "/dashboard/traces/explorer",
    "/dashboard/traces/map",
    "/dashboard/monitors",
    "/dashboard/monitors/new",
    "/dashboard/uptime",
    "/dashboard/uptime/mon_checkout",
    "/dashboard/incidents",
    "/status/upstat",
  ]) {
    await page.request.get(path);
  }
}

async function signIn(page: Page) {
  page.on("pageerror", (err) => console.log(`[pageerror] ${err.message}`));
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard**");
  await expect(page.getByTestId("dashboard-home")).toBeVisible();
}

async function goTo(page: Page, pillar: string) {
  await page
    .getByRole("navigation", { name: "Product navigation" })
    .getByRole("button", { name: pillar, exact: true })
    .click();
}

test("semantic landmarks: one main, nav rail, banner, single h1", async ({ page }) => {
  await signIn(page);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("navigation", { name: "Product navigation" })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible(); // TopBar <header>
  await expect(page.locator("main h1")).toHaveCount(1);
  await expect(page.locator("main h1")).toHaveText("Home — org health");
  // lists are real lists, not div-soup
  await expect(page.getByRole("list", { name: "Dashboards" }).first()).toBeVisible();
});

test("full journey: onboarding → B1 → dashboards → explorer → logs → trace → monitor → incident → status page", async ({ page }) => {
  test.setTimeout(300_000); // dev-mode route compiles dominate; generous budget
  // dev-persistent mock store: names must be unique per run (reused server)
  const run = Date.now().toString(36).slice(-5);
  // hermetic start — re-seed the §6 narrative (long-lived local servers
  // accumulate declared incidents/orgs from earlier runs)
  await page.request.post("/api/mock/v1/reset");
  await prewarm(page);
  await signIn(page);

  /* ---- B1 home: org health ---- */
  await expect(page.getByText("Home — org health")).toBeVisible();
  await expect(page.getByText("SLO burn")).toBeVisible();
  await expect(page.getByText("Triggered monitors")).toBeVisible();
  // MI-14: the seeded INC-42 sev1 keeps a persistent banner up
  await expect(page.getByText(/INC-42/).first()).toBeVisible();

  /* ---- first-run onboarding via a fresh org (create-org → first data) ---- */
  await page.getByRole("button", { name: /Upstat prod/i }).click();
  await page.getByTestId("new-org").click();
  await page.waitForURL("**/dashboard/onboarding**");
  await page.getByTestId("org-name").fill(`Acme ${run}`);
  await page.getByTestId("create-org").click();
  // send-your-first-data: ingest key + snippet + MI-16 radar
  await expect(page.getByTestId("ingest-key")).toBeVisible();
  await expect(page.getByText("Send your first data")).toBeVisible();
  // AFTER_TIMEOUT: the mock resolves waiting-for-data on a timer → B1
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  await expect(page.getByTestId("dashboard-home")).toBeVisible();
  // fresh org is empty: no dashboards yet
  await expect(page.getByText("No dashboards yet", { exact: false })).toBeVisible();

  // back to the seeded org (restores the primary narrative). The switch is
  // a FULL reload (location.assign) — wait for the reloaded TopBar to show
  // the primary org before navigating on.
  await page.getByRole("button", { name: new RegExp(`Acme ${run} prod`, "i") }).click();
  await page.getByRole("button", { name: /^Upstat/ }).click();
  await expect(page.getByRole("banner").getByRole("button", { name: /Upstat prod/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("list", { name: "Dashboards" }).getByText("Service overview")).toBeVisible();

  /* ---- B2 dashboards: create w/ widget picker → MI-11 edit mode ---- */
  await goTo(page, "Dashboards");
  await expect(page.getByTestId("dashboards-list")).toBeVisible();
  await expect(
    page.getByTestId("dashboards-list").getByText("Service overview"),
  ).toBeVisible();
  await page.getByTestId("new-dashboard").click();
  await page.getByTestId("dashboard-name").fill(`golden signals ${run}`);
  await page.getByRole("button", { name: "Timeseries" }).click();
  await page.getByTestId("create-dashboard").click();
  await page.waitForURL("**/dashboard/dashboards/*?edit=1");
  await expect(page.getByTestId("edit-toggle")).toHaveText("Done"); // landed editing
  await expect(page.getByTestId("timeseries-plot")).toBeVisible();

  // open the seeded dashboard: widgets render from the query endpoint
  await goTo(page, "Dashboards");
  await page.getByText("Service overview").click();
  await page.waitForURL("**/dashboard/dashboards/dash_overview**");
  await expect(page.getByText("p95 latency by service")).toBeVisible();
  await expect(page.getByTestId("timeseries-plot").first()).toBeVisible();

  /* ---- B3 metrics explorer drill (MI-6 facet → pill → chart) ---- */
  await goTo(page, "Metrics");
  await expect(page.getByTestId("metrics-explorer")).toBeVisible();
  await page.getByRole("checkbox", { name: "service: checkout" }).click();
  await expect(page.getByText("service:checkout").first()).toBeVisible(); // pill (MI-6)
  await expect(page.getByTestId("timeseries-plot")).toBeVisible();
  // MI-18: save the filter set as a named view → it morphs into a chip
  await page.getByTestId("save-view").click();
  await page.getByTestId("view-name").fill(`Checkout latency ${run}`);
  await page.getByTestId("confirm-save-view").click();
  await expect(
    page.getByRole("list", { name: "Saved views" }).getByText(`Checkout latency ${run}`),
  ).toBeVisible();

  /* ---- B4 logs: explorer + live tail (MI-4) ---- */
  await goTo(page, "Logs");
  await expect(page.getByTestId("logs-explorer")).toBeVisible();
  await expect(page.getByRole("list", { name: "Log lines" }).locator("li").first()).toBeVisible();
  // MI-5: expand a line into the JSON tree
  await page.getByRole("list", { name: "Log lines" }).locator("li button").first().click();
  await expect(page.locator("dl").first()).toBeVisible();
  // live tail streams batches
  const liveToggle = page.getByRole("banner").getByRole("button", { name: "live" });
  await liveToggle.click();
  const tailCount = await page.getByRole("list", { name: "Log lines" }).locator("li").count();
  await expect
    .poll(async () => page.getByRole("list", { name: "Log lines" }).locator("li").count(), {
      timeout: 10_000,
    })
    .toBeGreaterThan(tailCount);
  // MI-4: scrolling up pauses the tail (PAUSED pill + buffered count). The
  // list is a real overflow container (h-dvh app frame — QA 2026-07-19);
  // a body-scrolled page could never trigger the pause.
  // The tail starts from a small live window and grows a few lines per
  // poll — wait until it actually overflows its container.
  await expect
    .poll(
      () =>
        page
          .getByTestId("log-list")
          .evaluate((el) => el.scrollHeight - el.clientHeight),
      { timeout: 60_000 },
    )
    .toBeGreaterThan(200);
  await page.getByTestId("log-list").evaluate((el) => {
    el.scrollTop = 0; // unambiguously away from the bottom
    el.dispatchEvent(new Event("scroll"));
  });
  await expect(page.getByTestId("paused-pill")).toBeVisible({ timeout: 5_000 });
  // buffered chip appears as batches queue (dev polls every ~2s; allow a
  // few slow cycles), click-to-resume catches up
  const buffered = page.getByRole("button", { name: /\d+ new/ });
  await expect(buffered).toBeVisible({ timeout: 30_000 });
  await buffered.click();
  await expect(page.getByTestId("paused-pill")).toBeHidden({ timeout: 5_000 });
  await liveToggle.click(); // off again

  /* ---- B5 traces: explorer → waterfall → span drawer → map (MI-7) ---- */
  await goTo(page, "Traces");
  await expect(page.getByTestId("apm-services")).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "checkout" })).toBeVisible();
  await page.getByRole("link", { name: "Traces" }).click();
  await page.waitForURL("**/dashboard/traces/explorer**");
  await page.getByTestId("trace-9f86d081").click();
  await expect(page.getByTestId("trace-waterfall")).toBeVisible();
  await expect(page.getByText("POST /v1/events").first()).toBeVisible();
  // span click → drawer with tags
  await page.getByRole("list", { name: "Trace spans" }).getByText("clickhouse.insert").click();
  await expect(page.getByRole("complementary")).toBeVisible(); // SpanDrawer <aside>
  // MI-7 cross-link into the service map
  await page.getByTestId("map-crosslink").click();
  await page.waitForURL("**/dashboard/traces/map?service=api-common");
  await expect(page.getByTestId("service-map")).toBeVisible();
  await expect(page.getByText("highlight:")).toBeVisible();

  /* ---- B8 monitor create (type picker → define) + MI-9 replay ---- */
  await goTo(page, "Monitors");
  await expect(page.getByTestId("monitors-page")).toBeVisible();
  await page.getByTestId("new-monitor").click();
  await page.waitForURL("**/dashboard/monitors/new**");
  await page.getByTestId("check-name").fill(`payments heartbeat ${run}`);
  await page.getByTestId("check-url").fill("https://payments.cuesoft.io/healthz");
  await page.getByTestId("create-monitor").click();
  await page.waitForURL("**/dashboard/uptime/*");
  await expect(page.getByTestId("monitor-detail")).toBeVisible();
  await expect(page.getByText(`payments heartbeat ${run}`).first()).toBeVisible();
  // MI-9 on the seeded checkout monitor (its 24h includes the INC-42 spike)
  await page.goto("/dashboard/uptime/mon_checkout");
  await page.getByTestId("run-monitor-test").click();
  await expect(page.getByTestId("replay-panel")).toBeVisible();
  await expect(page.getByText(/would have fired ×[1-9]/)).toBeVisible();

  /* ---- B9 declare incident → MI-10 composer → status page reflects ---- */
  await goTo(page, "Incidents");
  await page.getByTestId("declare-incident").click();
  await page.getByTestId("incident-title").fill(`Elevated error rate on /v1/events (${run})`);
  await page.getByRole("combobox", { name: "Commander" }).click();
  await page.getByRole("option", { name: /Kemi/ }).click();
  await page.getByTestId("confirm-declare").click();
  await page.waitForURL("**/dashboard/incidents/*");
  await expect(page.getByTestId("incident-detail")).toBeVisible();
  // MI-10: slash-command update via the composer
  await page.getByRole("textbox", { name: "Incident update" }).fill("Mitigation under way");
  await page.getByRole("button", { name: "Post update" }).click();
  await expect(page.getByText("Mitigation under way")).toBeVisible();

  /* ---- public status page (light, outside the shell) reflects state ---- */
  await page.goto("/status/upstat");
  await expect(page.getByTestId("status-page")).toBeVisible();
  await expect(page.locator('[data-theme="light"]')).toBeVisible();
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByText("Major outage")).toBeVisible(); // the declared sev1
  await expect(page.getByText(`Elevated error rate on /v1/events (${run})`).first()).toBeVisible();
  await expect(page.getByRole("list", { name: "Components" }).locator("li").first()).toBeVisible();
});
