import { expect, test, type Page } from "@playwright/test";

/**
 * B8 "monitor status page (grouped by state)" [Decided 2026-07-20]: the
 * monitors rules list gains a List | By state toggle; By state groups the
 * rules worst-first — Triggered / Warn / OK / No data / Muted — with
 * counts, mute winning over evaluation state. URL-addressable as
 * ?view=state (design.md §1 query duality).
 *
 * Shared mutable mock narrative — serial by design (playwright.config).
 */
test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard**");
}

test("By state groups the seeded rules with counts; mute wins", async ({
  page,
}) => {
  await page.request.post("/api/mock/v1/reset");
  await signIn(page);

  await page.goto("/dashboard/monitors");
  await expect(page.getByTestId("monitors-page")).toBeVisible();

  // flat list is the default
  await expect(page.getByTestId("rules-view-list")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByTestId("rules-by-state")).toBeHidden();

  await page.getByTestId("rules-view-state").click();
  await expect(page.getByTestId("rules-by-state")).toBeVisible();

  // seeded narrative: 1 triggered · 2 warn · 1 ok · 0 nodata · 1 muted
  const counts: Record<string, string> = {
    triggered: "1",
    warn: "2",
    ok: "1",
    nodata: "0",
    muted: "1",
  };
  for (const [group, count] of Object.entries(counts)) {
    await expect(page.getByTestId(`rules-count-${group}`)).toHaveText(count);
  }

  // the alerting checkout rule sits under Triggered…
  await expect(
    page
      .getByTestId("rules-group-triggered")
      .getByTestId("rule-rule_checkout_p95"),
  ).toBeVisible();
  // …and the weekend-muted uptime rule groups under Muted despite state ok
  await expect(
    page
      .getByTestId("rules-group-muted")
      .getByTestId("rule-rule_homepage_uptime"),
  ).toBeVisible();

  // grouped cards keep the editor selection behavior
  await page
    .getByTestId("rules-group-muted")
    .getByTestId("rule-rule_homepage_uptime")
    .click();
  await expect(
    page.getByRole("heading", { name: /Edit rule — Homepage down/ }),
  ).toBeVisible();
});

test("?view=state deep-links the grouped view", async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard/monitors?view=state");
  await expect(page.getByTestId("rules-by-state")).toBeVisible();
  await expect(page.getByTestId("rules-view-state")).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // toggling back to List drops the param (URL round-trip)
  await page.getByTestId("rules-view-list").click();
  await expect(page.getByTestId("rules-by-state")).toBeHidden();
  await expect(page).toHaveURL(/\/dashboard\/monitors$/);
});
