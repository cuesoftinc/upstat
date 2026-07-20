import { expect, test, type Page } from "@playwright/test";

/**
 * B4 "LogLine list (virtualized)" — bespoke windowing over the explorer:
 * 10k seeded lines (`?limit=10000`, deep-linkable page size) render as a
 * bounded DOM slice between spacers that keep scrollHeight truthful, so
 * scrolling stays smooth and the MI-4 pause/buffer semantics are
 * unchanged (covered by dashboard.spec.ts). MI-5 expansion survives
 * windowing out and back.
 *
 * Shared mutable mock narrative — serial by design (playwright.config).
 */
test.describe.configure({ mode: "serial" });

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard**");
}

test("10k lines: bounded DOM, truthful scrollHeight, smooth jumps", async ({
  page,
}) => {
  await page.request.post("/api/mock/v1/reset");
  await signIn(page);

  await page.goto("/dashboard/logs?limit=10000&range=1h");
  await expect(page.getByTestId("logs-explorer")).toBeVisible();
  const list = page.getByTestId("log-list");
  const lines = page.getByTestId("log-lines");
  await expect(lines.locator("div[data-level]").first()).toBeVisible();

  // the full 10k-row content height exists…
  const metrics = await list.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(9_000 * 29);
  // …but only a window of rows is in the DOM (plus the two spacers)
  const renderedAtTop = await lines.locator("div[data-level]").count();
  expect(renderedAtTop).toBeLessThan(300);
  await expect(page.getByTestId("log-spacer-bottom")).toBeAttached();

  // jump around the list — every offset renders rows promptly
  const started = Date.now();
  for (const fraction of [0.5, 0.9, 0.1, 0.7, 0.3, 1]) {
    await list.evaluate((el, f) => {
      el.scrollTop = (el.scrollHeight - el.clientHeight) * f;
    }, fraction);
    await expect
      .poll(async () => lines.locator("div[data-level]").count(), {
        timeout: 5_000,
      })
      .toBeGreaterThan(10);
    const rendered = await lines.locator("div[data-level]").count();
    expect(rendered).toBeLessThan(300);
  }
  // six windowed jumps over 10k rows stay interactive (generous CI bound)
  expect(Date.now() - started).toBeLessThan(15_000);

  // the visible slice at the bottom is the newest edge (ascending order)
  await expect(page.getByTestId("log-spacer-top")).toBeAttached();
});

test("MI-5 expansion survives being windowed out and back", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/dashboard/logs?limit=10000&range=1h");
  const list = page.getByTestId("log-list");
  const lines = page.getByTestId("log-lines");
  const firstRow = lines.locator("div[data-level]").first();
  await expect(firstRow).toBeVisible();

  // expand the first rendered line (top of the list)
  await list.evaluate((el) => {
    el.scrollTop = 0;
  });
  const rowText = await firstRow
    .locator("button[aria-expanded]")
    .textContent();
  await firstRow.locator("button[aria-expanded]").click();
  await expect(
    lines.locator('div[data-level][data-expanded="true"]'),
  ).toHaveCount(1);

  // window it out (bottom), then back — the row is still expanded
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight;
  });
  await expect(
    lines.locator('div[data-level][data-expanded="true"]'),
  ).toHaveCount(0);
  await list.evaluate((el) => {
    el.scrollTop = 0;
  });
  const expanded = lines.locator('div[data-level][data-expanded="true"]');
  await expect(expanded).toHaveCount(1);
  expect(await expanded.locator("button[aria-expanded]").textContent()).toBe(
    rowText,
  );
});
