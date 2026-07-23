// a11y smoke gate (fleet parity — apparule/expendit axe-core coverage,
// docs+chore currency-and-parity wave): zero critical axe violations on
// the marketing home, /signin, and one representative dashboard route.
// Not a regression lock for a specific historical bug (see the sibling
// repos' axe-home/axe-transactions specs for that pattern) — this is the
// baseline sweep upstat didn't have yet.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoCriticalViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const critical = results.violations.filter(
    (violation) => violation.impact === "critical",
  );
  expect(
    critical.map((violation) => `${violation.id} ×${violation.nodes.length}`),
  ).toEqual([]);
}

test("home has zero critical axe violations", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /All your telemetry\./ }),
  ).toBeVisible();

  await expectNoCriticalViolations(page);
});

test("signin has zero critical axe violations", async ({ page }) => {
  await page.goto("/signin");
  await expect(page.getByTestId("signin-screen")).toBeVisible();

  await expectNoCriticalViolations(page);
});

test("dashboard home has zero critical axe violations", async ({ page }) => {
  await page.goto("/signin");
  await page
    .getByTestId("signin-screen")
    .getByRole("button", { name: /continue with google/i })
    .click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByTestId("dashboard-home")).toBeVisible();

  await expectNoCriticalViolations(page);
});
