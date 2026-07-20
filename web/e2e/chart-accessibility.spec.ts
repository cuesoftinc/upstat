import { expect, test, type Page } from "@playwright/test";

/**
 * design.md §5 accessibility — colorblind mode (Color vision toggle →
 * pattern fills/dashes/glyphs) and the chart data-table alternative.
 * Read-only against the seeded narrative; runs serially with the suite.
 */
test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard**");
  await expect(page.getByTestId("dashboard-home")).toBeVisible();
}

test("§5 colorblind mode: toggle persists (upstat.colorvision) and charts gain patterns", async ({
  page,
}) => {
  await signIn(page);

  // Settings → Appearance → Color vision
  await page.goto("/dashboard/settings");
  const toggle = page.getByRole("switch", { name: "Color vision patterns" });
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  // persisted like the theme contract: attribute + storage key
  await expect(page.locator("html")).toHaveAttribute(
    "data-colorvision",
    "patterns",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("upstat.colorvision")),
  ).toBe("patterns");

  // the seeded multi-series p95 widget renders dashed strokes (series 0
  // stays solid — the dash arrays differentiate the rest)
  await page.goto("/dashboard/dashboards/dash_overview");
  await expect(
    page
      .locator('[data-testid="timeseries-plot"] path[stroke-dasharray]')
      .first(),
  ).toBeVisible();

  // dot-only status pills carry glyphs (uptime cards)
  await page.goto("/dashboard/uptime");
  await expect(page.locator("[data-glyph]").first()).toBeVisible();

  // survives a reload via the pre-paint init script
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-colorvision",
    "patterns",
  );

  // and toggles cleanly off (storage entry removed — absence is default)
  await page.goto("/dashboard/settings");
  await page.getByRole("switch", { name: "Color vision patterns" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-colorvision");
  expect(
    await page.evaluate(() => localStorage.getItem("upstat.colorvision")),
  ).toBeNull();
});

test("§5 chart data-table toggle: a dashboard widget flips to the Table construction", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/dashboard/dashboards/dash_overview");

  // pin ONE timeseries widget by its stable id — a has-plot filter would
  // re-resolve to a different widget once this one flips to the table
  const firstPlotWidget = page
    .locator("[data-widget-id]")
    .filter({ has: page.getByTestId("timeseries-plot") })
    .first();
  await expect(firstPlotWidget).toBeVisible();
  const widgetId = await firstPlotWidget.getAttribute("data-widget-id");
  const panel = page.locator(`[data-widget-id="${widgetId}"]`);
  await expect(panel.getByTestId("timeseries-plot")).toBeVisible();

  const toggle = panel.getByRole("button", { name: "View as table" });
  // retry the click+flip as one unit — a click landing during hydration
  // can hit a not-yet-wired node (repo pattern for dev-server races)
  await expect(async () => {
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true", {
      timeout: 1_000,
    });
  }).toPass({ timeout: 15_000 });
  await expect(panel.getByTestId("timeseries-plot")).toHaveCount(0);

  const table = panel.getByTestId("chart-data-table");
  await expect(table).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Time" })).toBeVisible();
  // real table semantics with data rows
  expect(await table.getByRole("row").count()).toBeGreaterThan(2);

  // toggles back to the plot
  await toggle.click();
  await expect(panel.getByTestId("chart-data-table")).toHaveCount(0);
  await expect(panel.getByTestId("timeseries-plot")).toBeVisible();
});
