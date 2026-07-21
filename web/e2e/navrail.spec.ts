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

const rail = (page: Page) =>
  page.getByRole("navigation", { name: "Product navigation" });

test("defaults expanded at ≥1280px with labels and section groups", async ({
  page,
}) => {
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

test("foot chevron toggles and the choice persists across reloads", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  const toggle = page.getByTestId("rail-toggle");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  await toggle.click();
  await expect(rail(page)).toHaveAttribute("data-expanded", "false");
  expect(
    await page.evaluate(() => window.localStorage.getItem("nav.rail.expanded")),
  ).toBe("0");

  // persisted collapsed state wins over the ≥1280 expanded default
  await page.reload();
  await expect(rail(page)).toHaveAttribute("data-expanded", "false");

  // let the width transition settle, then retry the click until React's
  // handler is live (the reload assertion is satisfied pre-hydration)
  await expect(async () => {
    await toggle.click();
    await expect(rail(page)).toHaveAttribute("data-expanded", "true", {
      timeout: 1_000,
    });
  }).toPass({ timeout: 15_000 });
  await page.reload();
  await expect(rail(page)).toHaveAttribute("data-expanded", "true");
});

test("dashboard chrome theme toggle flips + persists (theme-parity canon)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  // Deterministic OS scheme — system-mode assertions must not depend on
  // the runner's OS (theme contract note, SKILL.md).
  await page.emulateMedia({ colorScheme: "light" });
  await signIn(page);
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme", "light");
  // dark(default) → system: stored explicitly; the emulated OS is light,
  // so the resolved attribute flips light.
  await page.getByRole("banner").getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(() => window.localStorage.getItem("upstat.theme")),
  ).toBe("system");
  // system → light: the explicit choice.
  await page.getByRole("banner").getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(() => window.localStorage.getItem("upstat.theme")),
  ).toBe("light");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  // the settings Appearance tab carries the same control as a labelled
  // select (routed tabs, 2026-07-20)
  await page.goto("/dashboard/settings/appearance");
  await expect(page.getByRole("combobox", { name: "Theme" })).toBeVisible();
  // restore dark for the rest of the suite
  await page.getByRole("banner").getByTestId("theme-toggle").click();
  await expect(html).not.toHaveAttribute("data-theme", "light");
});

test("below md, expansion is an overlay drawer — content never squeezes ([Clarified 2026-07-19])", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // desktop-persisted expansion must NOT apply below md — boots collapsed
  await page.addInitScript(() =>
    window.localStorage.setItem("nav.rail.expanded", "1"),
  );
  await signIn(page);
  await expect(rail(page)).toHaveAttribute("data-expanded", "false");
  await expect
    .poll(async () => Math.round((await rail(page).boundingBox())!.width))
    .toBe(56);
  const contentWidth = async () =>
    Math.round((await page.locator("main").boundingBox())!.width);
  const before = await contentWidth();

  // toggle opens the overlay drawer; the content keeps full width beneath
  await page.getByTestId("rail-toggle").click();
  const drawer = page.getByTestId("rail-drawer");
  await expect(drawer).toBeVisible();
  const box = (await drawer.boundingBox())!;
  expect(Math.round(box.width)).toBe(240);
  expect(await contentWidth()).toBe(before);
  await expect(page.getByTestId("rail-scrim")).toBeVisible();

  // scrim tap closes (tap right of the 240px drawer — the drawer overlaps
  // the scrim's center point)
  await page.getByTestId("rail-scrim").click({ position: { x: 370, y: 420 } });
  await expect(drawer).toBeHidden();
  await expect(rail(page)).toHaveAttribute("data-expanded", "false");

  // Escape closes too
  await page.getByTestId("rail-toggle").click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();

  // selecting a pillar navigates AND closes the drawer
  await page.getByTestId("rail-toggle").click();
  await drawer.getByRole("link", { name: "Logs", exact: true }).click();
  await page.waitForURL("**/dashboard/logs");
  await expect(drawer).toBeHidden();

  // the transient drawer never rewrites the persisted desktop choice
  expect(
    await page.evaluate(() => window.localStorage.getItem("nav.rail.expanded")),
  ).toBe("1");
});

test("navigation works at both rail widths (charts unaffected)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page);
  // expanded: click by visible label row
  // pillar items are real links (a11y audit) — role + href locked here
  const dashboards = rail(page).getByRole("link", {
    name: "Dashboards",
    exact: true,
  });
  await expect(dashboards).toHaveAttribute("href", "/dashboard/dashboards");
  await dashboards.click();
  await page.waitForURL("**/dashboard/dashboards");
  // collapse and navigate by icon (aria-label)
  await page.getByTestId("rail-toggle").click();
  await rail(page).getByRole("link", { name: "Metrics", exact: true }).click();
  await page.waitForURL("**/dashboard/metrics");
  await expect(page.getByTestId("timeseries-plot")).toBeVisible();
});
