// Skip link — fleet canon (P15, a11y audit 2026-07-21): first focusable on
// EVERY route, mounted once from the root layout — not just the dashboard
// shell (the rail + chrome there are 9+ tab stops before <main>). The first
// Tab on a fresh page load must land on "Skip to content", and activating it
// must move focus to the route's #main landmark (tabIndex={-1}) — not just
// scroll.
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard**");
  await expect(page.getByTestId("dashboard-home")).toBeVisible();
}

async function expectSkipLinkFlow(page: Page) {
  // Anchor focus at the document start — body is the post-navigation state.
  await page.locator("body").focus();

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
}

test("home: first Tab lands on the skip link; activating it focuses #main", async ({
  page,
}) => {
  await page.goto("/");
  await expectSkipLinkFlow(page);
});

test("signin: first Tab lands on the skip link; activating it focuses #main", async ({
  page,
}) => {
  await page.goto("/signin");
  await expectSkipLinkFlow(page);
});

test("dashboard: first Tab lands on the skip link; activating it focuses #main", async ({
  page,
}) => {
  await signIn(page);
  // Fresh document load: the signin click leaves the browser's
  // sequential-focus start point on a disconnected node after the
  // client-side redirect — the skip link contract is about page loads.
  await page.goto("/dashboard");
  await expectSkipLinkFlow(page);
});
