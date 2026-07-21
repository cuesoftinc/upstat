// Overlay focus-restore + dismissal canon (2026-07-21 a11y audit, fleet
// finding P4): closing the command palette must return focus to the element
// that opened it, and Escape must dismiss from ANYWHERE inside the dialog.
// Before the fix Escape was bound on the search input only — after Tab
// moved focus to an option the palette became un-dismissable — and closing
// dropped focus on <body>. Probe shape: open → move focus inside → Escape →
// closed AND focus back on the trigger.
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard**");
  await expect(page.getByTestId("dashboard-home")).toBeVisible();
}

test("palette: Escape works from an option and focus returns to the trigger", async ({
  page,
}) => {
  await signIn(page);
  const trigger = page.getByRole("button", { name: "Search" });
  await trigger.click();

  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();
  await expect(palette).toHaveAttribute("aria-modal", "true");

  // Move focus off the search input and onto an option — the audit's
  // broken case (Escape was a no-op here, stillOpen:true).
  await page.keyboard.press("Tab");
  await page.keyboard.press("Escape");

  await expect(palette).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("palette: ⌘K toggles it (fleet-standard invocation, P12)", async ({
  page,
}) => {
  await signIn(page);
  const anchor = page.getByTestId("rail-toggle");
  await anchor.focus();
  await expect(anchor).toBeFocused();

  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();

  // Second ⌘K toggles it closed (expendit parity) — even from the search
  // input — and focus returns to the pre-open element (P4).
  await page.keyboard.press("ControlOrMeta+k");
  await expect(palette).toBeHidden();
  await expect(anchor).toBeFocused();
});

test('palette: "/" opens it and Escape from the input restores focus too', async ({
  page,
}) => {
  await signIn(page);
  // Anchor focus somewhere stable first — the pre-open element is the
  // restore target for the hotkey path.
  const anchor = page.getByTestId("rail-toggle");
  await anchor.focus();
  await expect(anchor).toBeFocused();

  await page.keyboard.press("/");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect(palette).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
  await expect(anchor).toBeFocused();
});
