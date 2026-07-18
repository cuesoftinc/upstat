import { expect, test } from "@playwright/test";

/**
 * TEST_MODE smoke: the X-1 flow — /login shows exactly one Google CTA;
 * clicking it lands on the new IA root (/app) with data served by the
 * in-app mock server.
 */
test("login → app home via the single Google CTA", async ({ page }) => {
  await page.goto("/login");

  const screen = page.getByTestId("login-screen");
  await expect(screen).toBeVisible();
  await expect(screen.getByRole("heading", { name: "Sign in to Upstat" })).toBeVisible();

  // X-1: a single auth affordance, Google only (scoped to the screen —
  // the Next dev overlay injects its own buttons in dev mode).
  const cta = screen.getByRole("button", { name: /continue with google/i });
  await expect(cta).toBeVisible();
  await expect(screen.getByRole("button")).toHaveCount(1);

  await cta.click();
  await page.waitForURL("**/app");

  const home = page.getByTestId("app-home");
  await expect(home).toBeVisible();
  // Seeded org narrative served by the mock server.
  await expect(home.getByText("Upstat · Africa/Lagos")).toBeVisible();
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
