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

describe("MarketingNav (parity canon, SKILL.md 2026-07-19)", () => {
  it("renders the four canonical links with the ratified hrefs", () => {
    renderNav();
    expect(NAV_LINKS.map((l) => l.label)).toEqual(["Features", "Dashboards", "Docs", "GitHub"]);
    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute("href", "/#pillars");
    expect(screen.getByRole("link", { name: "Dashboards" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute(
      "href",
      "https://cuesoft.gitbook.io/upstat",
    );
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/cuesoftinc/upstat",
    );
  });

  it("carries the theme toggle and the Sign in CTA", () => {
    renderNav();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows the runtime star count on the GitHub link when provided (never static)", () => {
    renderNav({ starCount: 1284 });
    expect(screen.getByRole("link", { name: /GitHub/ })).toHaveTextContent("1,284");
  });

  it("keeps the GitHub link neutral without a runtime count", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "GitHub" })).toHaveTextContent(/^GitHub$/);
  });
});
