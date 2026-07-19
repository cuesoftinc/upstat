import { expect, test, type Page } from "@playwright/test";

/**
 * Expandable NavRail ([Directive 2026-07-19], design.md §2): collapsed 56px
 * ⇄ expanded 240px, foot chevron toggle, `nav.rail.expanded` persistence,
 * viewport default (expanded ≥1280px, collapsed below).
 */

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard**");
  await expect(page.getByTestId("dashboard-home")).toBeVisible();
}

const rail = (page: Page) => page.getByRole("navigation", { name: "Product navigation" });

test("defaults expanded at ≥1280px with labels and section groups", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  await expect(rail(page)).toHaveAttribute("data-expanded", "true");
  // poll: the 200ms width transition may still be running at first read
  await expect
    .poll(async () => Math.round((await rail(page).boundingBox())!.width))
    .toBe(240);
  for (const group of ["Telemetry", "Respond", "Platform"]) {
    await expect(rail(page).getByText(group)).toBeVisible();
  }
  await expect(rail(page).getByText("Dashboards")).toBeVisible();
});

test("defaults collapsed below 1280px", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await signIn(page);
  await expect(rail(page)).toHaveAttribute("data-expanded", "false");
  await expect
    .poll(async () => Math.round((await rail(page).boundingBox())!.width))
    .toBe(56);
  await expect(rail(page).getByText("Telemetry")).toBeHidden();
});

test("foot chevron toggles and the choice persists across reloads", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  const toggle = page.getByTestId("rail-toggle");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await toggle.click();
  await expect(rail(page)).toHaveAttribute("data-expanded", "false");
  expect(await page.evaluate(() => window.localStorage.getItem("nav.rail.expanded"))).toBe("0");

  // persisted collapsed state wins over the ≥1280 expanded default
  await page.reload();
  await expect(rail(page)).toHaveAttribute("data-expanded", "false");

  // let the width transition settle, then retry the click until React's
  // handler is live (the reload assertion is satisfied pre-hydration)
  await expect(async () => {
    await toggle.click();
    await expect(rail(page)).toHaveAttribute("data-expanded", "true", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await page.reload();
  await expect(rail(page)).toHaveAttribute("data-expanded", "true");
});

test("dashboard chrome theme toggle flips + persists (theme-parity canon)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme", "light");
  await page.getByRole("banner").getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => window.localStorage.getItem("upstat.theme"))).toBe("light");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  // settings carries the same control as a labelled select
  await page.goto("/dashboard/settings");
  await expect(page.getByRole("combobox", { name: "Theme" })).toBeVisible();
  // restore dark for the rest of the suite
  await page.getByRole("banner").getByTestId("theme-toggle").click();
  await expect(html).not.toHaveAttribute("data-theme", "light");
});

test("navigation works at both rail widths (charts unaffected)", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  // expanded: click by visible label row
  await rail(page).getByRole("button", { name: "Dashboards", exact: true }).click();
  await page.waitForURL("**/dashboard/dashboards");
  // collapse and navigate by icon (aria-label)
  await page.getByTestId("rail-toggle").click();
  await rail(page).getByRole("button", { name: "Metrics", exact: true }).click();
  await page.waitForURL("**/dashboard/metrics");
  await expect(page.getByTestId("timeseries-plot")).toBeVisible();
});
