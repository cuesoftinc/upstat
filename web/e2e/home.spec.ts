import { expect, test } from "@playwright/test";

/**
 * W2 landing flow (design.md §8.4): the Part A page renders every section,
 * the A15 FAQ stays single-open, and the CTAs hand off cross-page into the
 * app ("Login" flow → /signin). TEST_MODE: star badge stays neutral, demo
 * panels come from the synthetic seed via the home controller.
 */

test("home renders every Part A section", async ({ page }) => {
  // React #418 regression (QA 2026-07-19): the statically prerendered page
  // must hydrate without page errors — demo data is clock-independent on
  // the first render.
  const pageErrors: string[] = [];
  page.on("pageerror", (err) => pageErrors.push(err.message));

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
  await expect(page.getByText("CueLABS Discord — #upstat-lab")).toBeVisible();

  // A15 FAQ · A16 CTA band · A10 footer
  await expect(page.getByText("Questions, answered.")).toBeVisible();
  await expect(page.getByText("OTLP in. Answers out.")).toBeVisible();
  await expect(page.getByRole("contentinfo").getByText(/CueLABS™ Division/)).toBeVisible();

  // TEST_MODE: the nav star badge stays neutral — no invented star count
  const starBadge = page
    .getByRole("navigation", { name: "Marketing" })
    .getByRole("link", { name: "Star cuesoftinc/upstat on GitHub" });
  await expect(starBadge).toBeVisible();
  await expect(starBadge).toHaveText(/^Star$/);

  expect(pageErrors).toEqual([]);
});

test("nav + footer carry the canonical parity links (SKILL.md canon)", async ({ page }) => {
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Marketing" });
  for (const [label, href] of [
    ["Features", "/#pillars"],
    ["Dashboards", "/dashboard"],
    ["Docs", "https://cuesoft.gitbook.io/upstat"],
    // the GitHub item renders as the star badge (canon revision 2026-07-19)
    ["Star cuesoftinc/upstat on GitHub", "https://github.com/cuesoftinc/upstat"],
  ] as const) {
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("href", href);
  }
  await expect(nav.getByTestId("theme-toggle")).toBeVisible();
  await expect(nav.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
  await expect(nav.getByRole("button", { name: "Try Cloud" })).toBeVisible();

  const footer = page.getByRole("contentinfo"); // panel legends are scoped <footer>s — the landmark is the page footer
  const columns: [string, [string, string][]][] = [
    [
      "Product",
      [
        ["Features", "/#pillars"],
        ["Try Cloud", "/signin"],
        ["Self Host", "/#self-host"],
        ["Dashboards", "/dashboard"],
      ],
    ],
    [
      "Docs",
      [
        ["Docs", "https://cuesoft.gitbook.io/upstat"],
        ["Quickstart", "https://cuesoft.gitbook.io/upstat/setup"],
        ["API reference", "https://cuesoft.gitbook.io/upstat/system/api-surface"],
        ["Self-host guide", "https://cuesoft.gitbook.io/upstat/system/deployment"],
      ],
    ],
    [
      "Community",
      [
        ["GitHub", "https://github.com/cuesoftinc/upstat"],
        ["Discord", "https://discord.gg/CDfZxxrxbb"],
        ["Roadmap", "https://cuesoft.gitbook.io/upstat/product/roadmap"],
        ["CueLABS", "https://cuelabs.cuesoft.io"],
      ],
    ],
    [
      "Legal",
      [
        ["Privacy", "https://privacy.cuesoft.io"],
        ["Terms", "https://terms.cuesoft.io"],
        ["Status", "https://status.cuesoft.io"],
      ],
    ],
  ];
  for (const [heading, links] of columns) {
    const column = footer.getByRole("navigation", { name: heading });
    for (const [label, href] of links) {
      await expect(column.getByRole("link", { name: label })).toHaveAttribute("href", href);
    }
  }
  // legal bar: verbatim line + linked marks + language + security
  await expect(footer.locator("p", { hasText: "CueLABS™ Division" })).toHaveText(
    "© Cuesoft Inc. 2026. Upstat. CueLABS™ Division. MIT License.",
  );
  await expect(footer.getByRole("link", { name: "Cuesoft Inc." })).toHaveAttribute(
    "href",
    "https://cuesoft.io",
  );
  await expect(footer.getByRole("link", { name: "CueLABS™ Division" })).toHaveAttribute(
    "href",
    "https://cuelabs.cuesoft.io",
  );
  await expect(footer.getByRole("link", { name: "MIT License" })).toHaveAttribute(
    "href",
    "https://github.com/cuesoftinc/upstat/blob/main/LICENSE",
  );
  await expect(footer.getByRole("combobox", { name: "Language" })).toHaveValue("en");
  await expect(footer.getByRole("link", { name: "Security" })).toHaveAttribute(
    "href",
    "https://github.com/cuesoftinc/upstat/blob/main/SECURITY.md",
  );
});

test("theme toggle flips data-theme and persists (upstat.theme)", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme", "light"); // dark default
  await page.getByTestId("theme-toggle").click();
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => window.localStorage.getItem("upstat.theme"))).toBe("light");
  // persists across reload — applied pre-paint by the init script
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  // back to dark: attribute clears (the default carries none). The attr
  // assertion above is satisfied pre-hydration (init script), so retry the
  // click until React's handler is attached (dev hydrates slowly).
  await expect(async () => {
    await page.getByTestId("theme-toggle").click();
    await expect(html).not.toHaveAttribute("data-theme", "light", { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
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
  const nav = page.getByRole("navigation", { name: "Marketing" });

  // nav Try Cloud primary CTA (back per the canon revision 2026-07-19)
  await nav.getByRole("button", { name: "Try Cloud" }).click();
  await page.waitForURL("**/signin");
  await expect(page.getByTestId("signin-screen")).toBeVisible();

  // nav Sign in text link
  await page.goto("/");
  await nav.getByRole("link", { name: "Sign in" }).click();
  await page.waitForURL("**/signin");

  // hero CTA
  await page.goto("/");
  await page.getByRole("main").getByRole("button", { name: "Try Cloud" }).first().click();
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

  // A9 at mobile (live-QA finding 2026-07-19): the plan table's column CTAs
  // hide <sm; the grouped CTA pair renders above the compose snippet, and
  // the snippet wraps before its comment — never mid-comment.
  const cloudSection = page.getByText("Cloud when you want it. Yours when you need it.");
  await cloudSection.scrollIntoViewIfNeeded();
  const groupedCtas = page.getByLabel("Cloud or self-host");
  await expect(groupedCtas.getByRole("button", { name: "Deploy with compose" })).toBeVisible();
  // the table-footer copy of the CTA is display:none at 375
  await expect(page.locator("tfoot").getByRole("button", { name: "Deploy with compose" })).toBeHidden();
});

test("enabled controls carry the pointer cursor (Directive 2026-07-19)", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Marketing" });
  const cursorOf = (locator: ReturnType<typeof page.locator>) =>
    locator.evaluate((el) => getComputedStyle(el).cursor);
  // a rendered button — the base-layer rule, not a per-component class
  expect(await cursorOf(nav.getByRole("button", { name: "Try Cloud" }))).toBe("pointer");
  // a nav link — links keep the native pointer
  expect(await cursorOf(nav.getByRole("link", { name: "Docs" }))).toBe("pointer");
});

test("mobile nav is a menu-button disclosure at 390w (SKILL.md mobile clause)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "Marketing" });
  const menuButton = nav.getByRole("button", { name: "Menu" });
  const panel = nav.locator("#marketing-menu");

  // closed by default; the trigger advertises its state
  await expect(menuButton).toBeVisible();
  await expect(menuButton).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();

  // open — retry until React's handler is attached (dev hydrates slowly)
  await expect(async () => {
    await menuButton.click();
    await expect(panel).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
  await expect(menuButton).toHaveAttribute("aria-expanded", "true");

  // every canonical link is reachable from the panel — no dead ends <md
  for (const [label, href] of [
    ["Features", "/#pillars"],
    ["Dashboards", "/dashboard"],
    ["Docs", "https://cuesoft.gitbook.io/upstat"],
    // the GitHub item renders as the star badge (canon revision 2026-07-19)
    ["Star cuesoftinc/upstat on GitHub", "https://github.com/cuesoftinc/upstat"],
  ] as const) {
    const link = panel.getByRole("link", { name: label });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", href);
  }

  // the theme toggle works from inside the panel
  await panel.getByTestId("theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  // Sign in text link is present; the Try Cloud CTA hands off into the app
  await expect(panel.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
  await panel.getByRole("button", { name: "Try Cloud" }).click();
  await page.waitForURL("**/signin");
});
