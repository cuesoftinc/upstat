import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/design/ThemeProvider";
import { MARKETING_PILLARS } from "./PillarCard";
import { MarketingNav, NAV_LINKS } from "./MarketingNav";

const renderNav = (props: Parameters<typeof MarketingNav>[0] = {}) =>
  render(
    <ThemeProvider>
      <MarketingNav {...props} />
    </ThemeProvider>,
  );

describe("MarketingNav (parity canon, SKILL.md 2026-07-19, revised same day)", () => {
  it("renders the four canonical links with the ratified hrefs", () => {
    renderNav();
    expect(NAV_LINKS.map((l) => l.label)).toEqual([
      "Features",
      "Platform",
      "Docs",
      "GitHub",
    ]);
    // differentiated 2026-07-19: Features → the feature-highlights band
    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute(
      "href",
      "/#features",
    );
    expect(screen.getByRole("link", { name: "Platform" })).toHaveAttribute(
      "href",
      "/#pillars",
    );
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "https://cuesoft.gitbook.io/upstat",
    );
    // the GitHub item renders as the star badge (canon revision 2026-07-19)
    expect(
      screen.getByRole("link", { name: "Star cuesoftinc/upstat on GitHub" }),
    ).toHaveAttribute("href", "https://github.com/cuesoftinc/upstat");
  });

  it("carries the theme toggle, the Sign in link and the Try Cloud CTA", () => {
    renderNav();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/signin",
    );
    // two renderings of the one CTA ([Revised 2026-07-19]): compact below
    // md (the bar keeps it beside the hamburger) + standard on md+
    expect(screen.getAllByRole("button", { name: "Try Cloud" })).toHaveLength(
      2,
    );
  });

  it("shows the runtime star count on the star badge when provided (never static)", () => {
    renderNav({ starCount: 1284 });
    expect(
      screen.getByRole("link", { name: "Star cuesoftinc/upstat on GitHub" }),
    ).toHaveTextContent("1,284");
  });

  it("keeps the star badge neutral without a runtime count", () => {
    renderNav();
    expect(
      screen.getByRole("link", { name: "Star cuesoftinc/upstat on GitHub" }),
    ).toHaveTextContent(/^Star$/);
  });
});

describe("A1 Features pillar-map dropdown (design.md §8.2b dropdown-open)", () => {
  const chevron = () =>
    screen.getByRole("button", { name: "Features pillar map" });
  const group = () => screen.getByTestId("features-nav-item");
  const panel = () => screen.queryByTestId("features-dropdown");

  it("is closed by default and click-toggles on the chevron disclosure", () => {
    renderNav();
    expect(chevron()).toHaveAttribute("aria-expanded", "false");
    expect(panel()).not.toBeInTheDocument();
    fireEvent.click(chevron());
    expect(chevron()).toHaveAttribute("aria-expanded", "true");
    expect(panel()).toBeInTheDocument();
    fireEvent.click(chevron());
    expect(panel()).not.toBeInTheDocument();
  });

  it("keeps the canonical /#features link as the Features text item", () => {
    renderNav();
    // the dropdown supplements the parity link — it never replaces it
    expect(group().querySelector('a[href="/#features"]')).toHaveTextContent(
      "Features",
    );
  });

  it("renders the 8 pillar rows deep-linking the landing pillar grid", () => {
    renderNav();
    fireEvent.click(chevron());
    const rows = panel()!.querySelectorAll("a");
    expect(rows).toHaveLength(MARKETING_PILLARS.length);
    for (const { pillar } of MARKETING_PILLARS) {
      expect(
        [...rows].find((a) => a.getAttribute("href") === `/#pillar-${pillar}`),
      ).toBeTruthy();
    }
    // Figma dropdown-open copy: pillar 2 renders the shortened label
    expect(panel()).toHaveTextContent("Analytics / RUM");
    expect(panel()).not.toHaveTextContent("Website Analytics / RUM");
  });

  it("opens on hover; mouseleave closes after the grace delay", async () => {
    vi.useFakeTimers();
    try {
      renderNav();
      fireEvent.mouseEnter(group());
      expect(panel()).toBeInTheDocument();
      fireEvent.mouseLeave(group());
      // grace delay lets the pointer cross onto the panel
      expect(panel()).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(200));
      expect(panel()).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("closes on Escape, restoring trigger focus", () => {
    renderNav();
    fireEvent.click(chevron());
    expect(panel()).toBeInTheDocument();
    fireEvent.keyDown(group(), { key: "Escape" });
    expect(panel()).not.toBeInTheDocument();
    expect(chevron()).toHaveFocus();
  });

  it("closes when a pillar row is clicked", () => {
    renderNav();
    fireEvent.click(chevron());
    fireEvent.click(screen.getByRole("link", { name: /Logs/ }));
    expect(panel()).not.toBeInTheDocument();
  });
});
