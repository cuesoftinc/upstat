import { expect, test } from "@playwright/test";

/**
 * W2 landing flow (design.md §8.4): the Part A page renders every section,
 * the A15 FAQ stays single-open, and the CTAs hand off cross-page into the
 * app ("Login" flow → /signin). TEST_MODE: star badge stays neutral, demo
 * panels come from the synthetic seed via the home controller.
 */

test("home renders every Part A section", async ({ page }) => {
  await page.goto("/");

  // A2 hero — H1 + demo panels
  await expect(
    page.getByRole("heading", { level: 1, name: /All your telemetry\./ }),
  ).toBeVisible();
  await expect(page.getByText("p95 latency — api-common").first()).toBeVisible();
  await expect(page.getByText("api.cuesoft.io heartbeat").first()).toBeVisible();

  // A3 pillars ×8
  await expect(page.locator("#pillars [data-pillar]")).toHaveCount(8);

  // A5 OTel — snippet tabs + ingest flow
  await expect(page.getByText("Point your OpenTelemetry SDK at us. Done.")).toBeVisible();
  await expect(page.getByText("upstat ingest + storage")).toBeVisible();

  // A12 how it works — 3 steps
  for (const step of ["Point your SDK at us", "Send your first data", "See everything"]) {
    await expect(page.getByText(step)).toBeVisible();
  }

  // A4 demo band
  await expect(page.getByText("It looks like this — with your data.")).toBeVisible();
  await expect(page.getByText("availability · api-common")).toBeVisible();

  // A11 use-case quads ×4
  for (const quad of [
    "Dashboards that stay in sync",
    "From alert to postmortem",
    "Status pages people believe",
    "Analytics without the banner",
  ]) {
    await expect(page.getByText(quad)).toBeVisible();
  }

  // A6 status embed (also appears in the status-pages quad — scope to #status)
  await expect(page.getByText("We run on it. Publicly.")).toBeVisible();
  await expect(page.locator("#status").getByText("All systems operational")).toBeVisible();

  // A14 self-host · A9 table · A13 developers · A8 community
  await expect(page.getByText("Self-host — own your telemetry.")).toBeVisible();
  await expect(page.getByText("Cloud when you want it. Yours when you need it.")).toBeVisible();
  await expect(
    page.getByText("Go gRPC services · Next.js + React/TS · ClickHouse · OpenTelemetry"),
  ).toBeVisible();
  await expect(page.getByText("CueLABS Discord — #upstat")).toBeVisible();

  // A15 FAQ · A16 CTA band · A10 footer
  await expect(page.getByText("Questions, answered.")).toBeVisible();
  await expect(page.getByText("OTLP in. Answers out.")).toBeVisible();
  await expect(page.getByText("© 2026 Cuesoft · upstat is CueLABS open source")).toBeVisible();

  // TEST_MODE: the GitHub badge stays neutral — no invented star count
  await expect(page.getByRole("link", { name: /^Star$/ })).toBeVisible();
});

test("FAQ is a single-open accordion (A15)", async ({ page }) => {
  await page.goto("/");
  const first = "Does it work with my existing OpenTelemetry setup?";
  const second = "What are the retention defaults?";

  // first item ships open
  const faq = page.locator("#faq");
  await faq.scrollIntoViewIfNeeded();
  await expect(faq.locator("[data-expanded=true]")).toHaveCount(1);
  await expect(faq.getByText(/Point any OTLP exporter/)).toBeVisible();

  await faq.getByRole("button", { name: second }).click();
  await expect(faq.getByText(/Retention is configurable per signal/)).toBeVisible();
  // still exactly one open — the first closed
  await expect(faq.locator("[data-expanded=true]")).toHaveCount(1);
  await expect(faq.getByText(/Point any OTLP exporter/)).toBeHidden();

  // toggling the open item closes it (none open)
  await faq.getByRole("button", { name: second }).click();
  await expect(faq.locator("[data-expanded=true]")).toHaveCount(0);
  await expect(faq.getByRole("button", { name: first })).toBeVisible();
});

test("CTAs hand off into the app: Try Cloud → /signin (§8.4 cross-page)", async ({ page }) => {
  await page.goto("/");
  // hero CTA
  await page.getByRole("button", { name: "Try Cloud" }).nth(1).click();
  await page.waitForURL("**/signin");
  await expect(page.getByTestId("signin-screen")).toBeVisible();

  // nav CTA
  await page.goto("/");
  await page.getByRole("button", { name: "Try Cloud" }).first().click();
  await page.waitForURL("**/signin");

  // nav Sign in
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/signin");

  // final CTA band
  await page.goto("/");
  await page.getByRole("button", { name: "Try Cloud" }).last().click();
  await page.waitForURL("**/signin");
});

test("Self Host CTA scrolls to the self-host section (A14)", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Self Host" }).first().click();
  await expect(page.locator("#self-host")).toBeInViewport();
});

test("home is responsive at 375w (mobile)", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /All your telemetry\./ }),
  ).toBeVisible();
  // no horizontal overflow — html AND body (unwrapped <pre> text overflows
  // body.scrollWidth without moving documentElement.scrollWidth)
  const overflow = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    return Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - vw;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  // pillar grid stacks and stays reachable
  await page.locator("#pillars").scrollIntoViewIfNeeded();
  await expect(page.locator("#pillars [data-pillar]")).toHaveCount(8);
});
