import { expect, test } from "@playwright/test";

/**
 * App-level error boundary (#413): a render error inside a page must land on
 * app/error.tsx — heading, retry action and a link home — instead of Next's
 * default fallback. /dev/crash throws on purpose and exists only in TEST_MODE.
 */
test("a page that throws renders the app-level error page", async ({
  page,
}) => {
  await page.goto("/dev/crash");

  await expect(
    page.getByRole("heading", { name: "Something went wrong." }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Go to the dashboard" }),
  ).toHaveAttribute("href", "/dashboard");
});
