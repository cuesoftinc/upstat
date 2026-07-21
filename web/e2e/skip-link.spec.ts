// Skip link — fleet canon (P15, a11y audit 2026-07-21): the rail + chrome
// are 9+ tab stops before <main> on every dashboard page. The first Tab on
// a fresh page must land on "Skip to content", and activating it must move
// focus to the #main landmark (tabIndex={-1}) — not just scroll.
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard**");
  await expect(page.getByTestId("dashboard-home")).toBeVisible();
}

test("first Tab lands on the skip link; activating it focuses #main", async ({
  page,
}) => {
  await signIn(page);
  // Anchor focus at the document start — body is the post-navigation state.
  await page.locator("body").focus();

  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(page.locator("main#main")).toBeFocused();
});
