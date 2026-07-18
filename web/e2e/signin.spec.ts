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
  // Seeded org narrative served by the mock server.
  await expect(home.getByText("Upstat · Africa/Lagos")).toBeVisible();
});

test("/login permanently redirects to /signin (no 404 for old links)", async ({ request }) => {
  const response = await request.get("/login", { maxRedirects: 0 });
  expect(response.status()).toBe(308);
  expect(response.headers()["location"]).toContain("/signin");
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
