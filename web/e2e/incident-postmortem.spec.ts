import { expect, test, type Page } from "@playwright/test";

/**
 * B9 postmortem template — "postmortem doc template on resolve": the
 * seeded resolved incident (INC-41) renders its composed postmortem; a
 * live incident resolved through the MI-10 composer gains the **Start
 * postmortem** affordance, the composer auto-fills the timeline, and the
 * saved doc lists on the incident detail.
 *
 * Shared mutable mock narrative — serial by design (playwright.config).
 */
test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard**");
}

test("seeded resolved incident lists its postmortem on the detail", async ({
  page,
}) => {
  await page.request.post("/api/mock/v1/testing/reset");
  await signIn(page);

  await page.goto("/dashboard/incidents/inc_41");
  await expect(page.getByTestId("incident-detail")).toBeVisible();
  const postmortem = page.getByTestId("postmortem");
  await expect(postmortem).toBeVisible();
  await expect(
    postmortem.getByRole("heading", { name: "Postmortem" }),
  ).toBeVisible();
  // the template sections
  await expect(
    postmortem.getByRole("heading", { name: "Impact" }),
  ).toBeVisible();
  await expect(
    postmortem.getByRole("heading", { name: "Root cause" }),
  ).toBeVisible();
  await expect(postmortem.getByText(/origin-shield route/)).toBeVisible();
  // frozen timeline rendered inside the doc
  await expect(
    postmortem.getByText("Rolled back CDN config; all checks green for 15m.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    postmortem.getByRole("button", { name: "Edit postmortem" }),
  ).toBeVisible();
});

test("resolve → Start postmortem → composed doc lands on the detail", async ({
  page,
}) => {
  await page.request.post("/api/mock/v1/testing/reset");
  await signIn(page);

  // INC-42 is seeded MONITORING — no postmortem affordance yet
  await page.goto("/dashboard/incidents/inc_42");
  await expect(page.getByTestId("incident-detail")).toBeVisible();
  await expect(page.getByTestId("postmortem")).toBeHidden();

  // resolve via the MI-10 slash command
  await page
    .getByRole("textbox", { name: "Incident update" })
    .fill("/status resolved Error rate stable for 30m — resolving.");
  await page.getByRole("button", { name: "Post update" }).click();

  // the postmortem template unlocks on resolve
  const start = page.getByTestId("start-postmortem");
  await expect(start).toBeVisible();
  await start.click();

  // the timeline auto-fills from the incident events (oldest entry first)
  const dialog = page.getByRole("dialog", { name: /Postmortem — INC-42/ });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText("Declared SEV-1.", { exact: false }),
  ).toBeVisible();

  await dialog
    .getByLabel("Impact")
    .fill("Checkout errors elevated for 45 minutes; no data loss.");
  await dialog
    .getByLabel("Root cause")
    .fill("Ingest retry storm saturated the ClickHouse insert queue.");
  await dialog
    .getByLabel("Action items (one per line)")
    .fill("Cap ingest-gw retries\nAlert on insert-queue depth");
  await page.getByTestId("save-postmortem").click();

  // saved → listed on the incident detail
  const postmortem = page.getByTestId("postmortem");
  await expect(
    postmortem.getByText("Checkout errors elevated for 45 minutes", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(postmortem.getByText("Cap ingest-gw retries")).toBeVisible();
  await expect(
    postmortem.getByRole("button", { name: "Edit postmortem" }),
  ).toBeVisible();

  // survives a reload (persisted in the mock store)
  await page.reload();
  await expect(
    page.getByTestId("postmortem").getByText("Cap ingest-gw retries"),
  ).toBeVisible();

  // leave the narrative clean for later specs
  await page.request.post("/api/mock/v1/testing/reset");
});
