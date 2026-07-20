import { expect, test, type Page } from "@playwright/test";

/**
 * B12 routed settings tabs (ratified 2026-07-20): seven REAL sub-routes
 * under /dashboard/settings — General | Members | Keys & properties |
 * Integrations | Data & privacy (/retention) | Appearance | Usage.
 * Tab clicks change the URL and swap the pane, deep links direct-load a
 * tab, the bare route redirects to the first tab, back/forward retrace
 * the tab trail, the NavRail Settings pillar stays active across
 * sub-routes, and the bar h-scrolls inside the viewport on mobile.
 */

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard**");
  await expect(page.getByTestId("dashboard-home")).toBeVisible();
}

const tablist = (page: Page) =>
  page.getByRole("tablist", { name: "Settings sections" });

test("bare /dashboard/settings redirects to the first tab", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/dashboard/settings");
  await page.waitForURL("**/dashboard/settings/general");

  await expect(
    page.getByRole("heading", { name: "Settings", level: 1 }),
  ).toBeVisible();
  await expect(tablist(page).getByRole("tab")).toHaveText([
    "General",
    "Members",
    "Keys & properties",
    "Integrations",
    "Data & privacy",
    "Appearance",
    "Usage",
  ]);
  await expect(
    tablist(page).getByRole("tab", { name: "General" }),
  ).toHaveAttribute("aria-current", "page");
});

test("tab click changes the URL and swaps the pane; back/forward retrace", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/dashboard/settings");
  await page.waitForURL("**/dashboard/settings/general");
  await expect(
    page.getByRole("region", { name: "Organization" }),
  ).toBeVisible();

  // click → URL changes, pane swaps (Keys & properties merges the old
  // /keys + /properties focused screens), aria-current moves
  await tablist(page).getByRole("tab", { name: "Keys & properties" }).click();
  await page.waitForURL("**/dashboard/settings/keys");
  await expect(
    page.getByRole("region", { name: "API keys & ingestion tokens" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Property keys (RUM)" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Organization" }),
  ).not.toBeVisible();
  await expect(
    tablist(page).getByRole("tab", { name: "Keys & properties" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    tablist(page).getByRole("tab", { name: "General" }),
  ).toHaveAttribute("aria-selected", "false");

  // Data & privacy keeps its pre-tab /retention URL
  await tablist(page).getByRole("tab", { name: "Data & privacy" }).click();
  await page.waitForURL("**/dashboard/settings/retention");
  await expect(
    page.getByRole("region", { name: "Retention per signal" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Privacy & data controls" }),
  ).toBeVisible();

  // browser history retraces the tab trail
  await page.goBack();
  await page.waitForURL("**/dashboard/settings/keys");
  await expect(
    page.getByRole("region", { name: "API keys & ingestion tokens" }),
  ).toBeVisible();
  await page.goBack();
  await page.waitForURL("**/dashboard/settings/general");
  await expect(
    page.getByRole("region", { name: "Organization" }),
  ).toBeVisible();
  await page.goForward();
  await page.waitForURL("**/dashboard/settings/keys");
  await expect(
    tablist(page).getByRole("tab", { name: "Keys & properties" }),
  ).toHaveAttribute("aria-current", "page");
});

test("deep link direct-loads the Usage tab; NavRail stays active on sub-routes", async ({
  page,
}) => {
  await signIn(page);
  // Usage kept its pre-tab URL — the tab IS the old route
  await page.goto("/dashboard/settings/usage");
  await page.waitForURL("**/dashboard/settings/usage");

  await expect(
    tablist(page).getByRole("tab", { name: "Usage" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("settings-usage")).toBeVisible();

  // the NavRail Settings pillar marks the current page across sub-routes
  await expect(
    page
      .getByRole("navigation", { name: "Product navigation" })
      .getByRole("button", { name: "Settings" }),
  ).toHaveAttribute("aria-current", "page");
});

test("mobile: the tab bar scrolls horizontally inside the viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto("/dashboard/settings/general");
  await page.waitForURL("**/dashboard/settings/general");

  const list = tablist(page);
  await expect(list).toBeVisible();
  const report = await list.evaluate((el) => ({
    overflowX: getComputedStyle(el).overflowX,
    withinViewport: el.getBoundingClientRect().width <= window.innerWidth + 1,
    docSideScroll:
      Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
      ) >
      window.innerWidth + 1,
  }));
  expect(report.overflowX).toBe("auto");
  expect(report.withinViewport).toBe(true);
  expect(report.docSideScroll).toBe(false);

  // seven tabs at 390w overflow the bar — the last one is reachable by
  // scrolling the bar itself
  const last = list.getByRole("tab", { name: "Usage" });
  await last.scrollIntoViewIfNeeded();
  await expect(last).toBeVisible();
});
