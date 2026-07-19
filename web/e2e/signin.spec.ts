import { expect, test } from "@playwright/test";

/**
 * TEST_MODE smoke: the X-1 flow — /signin shows exactly one Google CTA;
 * clicking it lands on the app root (/dashboard, route standard) with data
 * served by the in-app mock server.
 */
test("signin → dashboard home via the single Google CTA", async ({ page }) => {
  await page.goto("/signin");

  const screen = page.getByTestId("signin-screen");
  await expect(screen).toBeVisible();
  await expect(screen.getByRole("heading", { name: "Sign in to Upstat" })).toBeVisible();

  // X-1: a single auth affordance, Google only (scoped to the screen —
  // the Next dev overlay injects its own buttons in dev mode).
  const cta = screen.getByRole("button", { name: /continue with google/i });
  await expect(cta).toBeVisible();
  await expect(screen.getByRole("button")).toHaveCount(1);

  await cta.click();
  await page.waitForURL("**/dashboard");

  const home = page.getByTestId("dashboard-home");
  await expect(home).toBeVisible();
  // B1 org-health screen served from the seeded narrative.
  await expect(home.getByRole("heading", { name: "Home — org health" })).toBeVisible();
});

test("/login 404s on the branded page (redirect stub removed 2026-07-19)", async ({ page }) => {
  // user decision: the /login → /signin stub is gone — /signin is the only
  // auth route; stale links land on the branded not-found page
  const response = await page.goto("/login");
  expect(response!.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /This page doesn/ })).toBeVisible();
});

test("signin column stays constrained at desktop width", async ({ page }) => {
  // Regression (live bug): an unlayered/legacy `main { min-width: 100vw }`
  // in globals.css beat the 360px max-width (min-width wins the property
  // conflict regardless of cascade layers), stretching the signin column to
  // the full viewport.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/signin");

  const main = page.getByTestId("signin-screen").locator("main");
  await expect(main).toBeVisible();
  const box = await main.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThanOrEqual(380);
  // And it sits centered, not pinned to an edge.
  const viewport = page.viewportSize()!;
  const center = box!.x + box!.width / 2;
  expect(Math.abs(center - viewport.width / 2)).toBeLessThanOrEqual(2);
});

test("mock server serves the seeded narrative", async ({ request }) => {
  const org = await request.get("/api/mock/v1/orgs/current");
  expect(org.ok()).toBeTruthy();
  expect(await org.json()).toMatchObject({ name: "Upstat", timezone: "Africa/Lagos" });

  const incidents = await request.get("/api/mock/v1/incidents");
  const list = await incidents.json();
  expect(list.some((i: { key: string; status: string }) => i.key === "INC-42" && i.status === "monitoring")).toBeTruthy();

  const trace = await request.get("/api/mock/v1/traces/9f86d081884c7d659a2feaa0c55ad015");
  const traceBody = await trace.json();
  expect(traceBody.spans).toHaveLength(6);
  expect(traceBody.root_name).toBe("POST /v1/events");
});
