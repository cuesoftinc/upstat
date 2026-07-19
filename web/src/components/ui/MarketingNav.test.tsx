import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/design/ThemeProvider";
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
    expect(NAV_LINKS.map((l) => l.label)).toEqual(["Features", "Platform", "Docs", "GitHub"]);
    // differentiated 2026-07-19: Features → the feature-highlights band
    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute("href", "/#features");
    expect(screen.getByRole("link", { name: "Platform" })).toHaveAttribute("href", "/#pillars");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "https://cuesoft.gitbook.io/upstat",
    );
    // the GitHub item renders as the star badge (canon revision 2026-07-19)
    expect(screen.getByRole("link", { name: "Star cuesoftinc/upstat on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/cuesoftinc/upstat",
    );
  });

  it("carries the theme toggle, the Sign in link and the Try Cloud CTA", () => {
    renderNav();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");
    // two renderings of the one CTA ([Revised 2026-07-19]): compact below
    // md (the bar keeps it beside the hamburger) + standard on md+
    expect(screen.getAllByRole("button", { name: "Try Cloud" })).toHaveLength(2);
  });

  it("shows the runtime star count on the star badge when provided (never static)", () => {
    renderNav({ starCount: 1284 });
    expect(screen.getByRole("link", { name: "Star cuesoftinc/upstat on GitHub" })).toHaveTextContent(
      "1,284",
    );
  });

  it("keeps the star badge neutral without a runtime count", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "Star cuesoftinc/upstat on GitHub" })).toHaveTextContent(
      /^Star$/,
    );
  });
});
