// Contrast-token lock (design.md §2 AA text variants + on-crit) —
// recomputes the 2026-07-21 audit's failing pairs from the SERVED CSS
// (custom-property values off the live document, both themes) and asserts
// WCAG AA. The tinted-chip recipe (`text-X` on `bg-X/10–15`), brand/status
// text, and crit-fill labels must stay ≥4.5:1; rendered sweeps lock the
// PUBLIC status-page pills (both themes) and the dark SEV-1 badge.
import { expect, test, type Locator, type Page } from "@playwright/test";

const AA = 4.5;

// ---- WCAG 2.x math over sRGB --------------------------------------------
type Rgb = { r: number; g: number; b: number };

function hexToRgb(hex: string): Rgb {
  const h = hex.trim().replace("#", "");
  const v =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  };
}

function luminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a: Rgb, b: Rgb): number {
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
}

/** `bg-X/nn` composited over an opaque base (what the browser paints). */
function tint(hue: Rgb, alpha: number, base: Rgb): Rgb {
  const mix = (f: number, g: number) => Math.round(alpha * f + (1 - alpha) * g);
  return {
    r: mix(hue.r, base.r),
    g: mix(hue.g, base.g),
    b: mix(hue.b, base.b),
  };
}

// ---- served-CSS readers ---------------------------------------------------
async function readTokens(
  page: Page,
  theme: "light" | "dark",
  names: string[],
): Promise<Record<string, Rgb>> {
  const raw = await page.evaluate(
    ({ t, ns }: { t: string; ns: string[] }) => {
      document.documentElement.setAttribute("data-theme", t);
      const cs = getComputedStyle(document.documentElement);
      return Object.fromEntries(
        ns.map((n) => [n, cs.getPropertyValue(n).trim()]),
      );
    },
    { t: theme, ns: names },
  );
  const out: Record<string, Rgb> = {};
  for (const [name, value] of Object.entries(raw)) {
    // The dev server may serve minified hex (#fff) — accept both forms.
    expect(value, `${name} is declared in the served CSS (${theme})`).toMatch(
      /^#([0-9a-f]{3}|[0-9a-f]{6})$/i,
    );
    out[name] = hexToRgb(value);
  }
  return out;
}

const TOKENS = [
  "--color-bg",
  "--color-bg-elev",
  "--color-brand",
  "--color-on-brand",
  "--color-ok",
  "--color-warn",
  "--color-crit",
  "--color-nodata",
  "--color-text-2",
  "--color-on-crit",
  "--color-brand-text",
  "--color-ok-text",
  "--color-warn-text",
  "--color-crit-text",
  "--color-nodata-text",
  "--color-text-2-text",
];

test("§2 token pairs recomputed from served CSS clear WCAG AA in both themes", async ({
  page,
}) => {
  await page.goto("/signin");
  for (const theme of ["dark", "light"] as const) {
    const t = await readTokens(page, theme, TOKENS);
    const cases: Array<{ name: string; fg: Rgb; bg: Rgb }> = [];
    const surfaces = ["--color-bg", "--color-bg-elev"] as const;

    // Tinted-recipe pairs: the `-text` label on every alpha its hue ships
    // with (StatusPill/LevelChip/AlertFeedRow /14, NavRail /15, ok-chips
    // /15, CountBadge /12, WidgetTypeCell-SavedViewChip-IncidentHistory
    // /10, QueryValue /8), over both surfaces.
    const recipes: Array<[string, string, number[]]> = [
      ["--color-brand-text", "--color-brand", [0.1, 0.12, 0.14, 0.15]],
      ["--color-ok-text", "--color-ok", [0.1, 0.14, 0.15]],
      ["--color-warn-text", "--color-warn", [0.1, 0.14]],
      ["--color-crit-text", "--color-crit", [0.08, 0.1, 0.14, 0.15]],
      ["--color-nodata-text", "--color-nodata", [0.14]],
      ["--color-text-2-text", "--color-text-2", [0.14]],
    ];
    for (const [fg, hue, alphas] of recipes) {
      for (const alpha of alphas) {
        for (const surface of surfaces) {
          cases.push({
            name: `${fg} on ${hue}/${alpha * 100} over ${surface}`,
            fg: t[fg],
            bg: tint(t[hue], alpha, t[surface]),
          });
        }
      }
    }

    // Plain status/brand text on the page surfaces.
    for (const fg of [
      "--color-brand-text",
      "--color-ok-text",
      "--color-warn-text",
      "--color-crit-text",
      "--color-nodata-text",
      "--color-text-2-text",
    ]) {
      for (const surface of surfaces) {
        cases.push({ name: `${fg} on ${surface}`, fg: t[fg], bg: t[surface] });
      }
    }

    // Fill labels: on-crit on the crit fill (destructive Button, SEV-1,
    // CountBadge) and the standing on-brand pairs (§2 decisions).
    cases.push({
      name: "--color-on-crit on --color-crit fill",
      fg: t["--color-on-crit"],
      bg: t["--color-crit"],
    });
    cases.push({
      name: "--color-on-brand on --color-brand fill",
      fg: t["--color-on-brand"],
      bg: t["--color-brand"],
    });
    cases.push({
      name: "--color-on-brand on --color-warn fill (SEV-2)",
      fg: t["--color-on-brand"],
      bg: t["--color-warn"],
    });

    for (const c of cases) {
      const ratio = contrast(c.fg, c.bg);
      expect
        .soft(ratio, `${theme}: ${c.name} ≥ ${AA} (got ${ratio.toFixed(2)})`)
        .toBeGreaterThanOrEqual(AA);
    }
  }
});

// ---- rendered helpers -------------------------------------------------------
type Rendered = { label: string; ratio: number } | null;

async function renderedRatio(el: Locator): Promise<Rendered> {
  return el.evaluate((node) => {
    type C = { r: number; g: number; b: number; a: number };
    const parse = (s: string): C => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return { r: 0, g: 0, b: 0, a: 0 };
      const [r, g, b, a = "1"] = m[1].split(/[,/ ]+/).filter(Boolean);
      return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
    };
    const over = (top: C, base: C): C => ({
      r: top.r * top.a + base.r * (1 - top.a),
      g: top.g * top.a + base.g * (1 - top.a),
      b: top.b * top.a + base.b * (1 - top.a),
      a: 1,
    });
    const layers: C[] = [];
    let n: Element | null = node;
    let opaque = false;
    while (n) {
      const bg = parse(getComputedStyle(n).backgroundColor);
      if (bg.a > 0) layers.push(bg);
      if (bg.a >= 1) {
        opaque = true;
        break;
      }
      n = n.parentElement;
    }
    if (!opaque)
      layers.push(parse(getComputedStyle(document.body).backgroundColor));
    let backdrop = layers[layers.length - 1];
    for (let j = layers.length - 2; j >= 0; j--) {
      backdrop = over(layers[j], backdrop);
    }
    const fg = parse(getComputedStyle(node).color);
    if (fg.a < 1) return null;
    const lum = (c: C) => {
      const lin = (v: number) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
    };
    const [lo, hi] = [lum(fg), lum(backdrop)].sort((x, y) => x - y);
    return {
      label: (node.textContent ?? "").trim().slice(0, 24),
      ratio: (hi + 0.05) / (lo + 0.05),
    };
  });
}

// ---- rendered surface: PUBLIC status page pills, both themes ---------------
test("public status page pills render ≥4.5:1 in both themes (served pages)", async ({
  page,
}) => {
  await page.goto("/status/upstat");
  const pills = page.locator("span[data-status]");
  await pills.first().waitFor({ state: "visible", timeout: 15_000 });

  for (const theme of ["dark", "light"] as const) {
    await page.evaluate(
      (t) => document.documentElement.setAttribute("data-theme", t),
      theme,
    );
    const count = await pills.count();
    expect(count, "status page renders status pills").toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const result = await renderedRatio(pills.nth(i));
      if (result === null) continue;
      expect
        .soft(
          result.ratio,
          `${theme}: status pill "${result.label}" renders ≥ ${AA} (got ${result.ratio.toFixed(2)})`,
        )
        .toBeGreaterThanOrEqual(AA);
    }
  }
});

// ---- rendered surface: SEV badges in dark theme (the on-crit fix) ----------
test("incident SEV badges render ≥4.5:1 in dark theme (served pages)", async ({
  page,
}) => {
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard**");
  await page.goto("/dashboard/incidents");
  await page.evaluate(() =>
    document.documentElement.setAttribute("data-theme", "dark"),
  );

  const chips = page.locator("[data-sev]");
  await chips.first().waitFor({ state: "visible", timeout: 15_000 });
  const count = await chips.count();
  expect(count, "incidents page renders SEV chips").toBeGreaterThan(0);

  for (let i = 0; i < count; i++) {
    const result = await renderedRatio(chips.nth(i));
    if (result === null) continue;
    expect
      .soft(
        result.ratio,
        `dark: SEV chip "${result.label}" renders ≥ ${AA} (got ${result.ratio.toFixed(2)})`,
      )
      .toBeGreaterThanOrEqual(AA);
  }
});
