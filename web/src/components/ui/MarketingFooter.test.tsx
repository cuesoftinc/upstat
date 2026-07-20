import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MarketingFooter } from "./MarketingFooter";

/** The ratified column/link set (SKILL.md parity canon, 2026-07-19). */
const CANON: Record<string, [string, string][]> = {
  Product: [
    ["Features", "/#features"], // differentiated 2026-07-19
    ["Try Cloud", "/signin"],
    ["Self Host", "/#self-host"],
    ["Platform", "/#pillars"],
  ],
  Docs: [
    ["Docs", "https://cuesoft.gitbook.io/upstat"],
    ["Quickstart", "https://cuesoft.gitbook.io/upstat/setup"],
    // In-product Scalar reference (X-2) — /docs/api renders the spec.
    ["API reference", "/docs/api"],
    ["Self-host guide", "https://cuesoft.gitbook.io/upstat/system/deployment"],
  ],
  Community: [
    ["GitHub", "https://github.com/cuesoftinc/upstat"],
    ["Discord", "https://discord.gg/CDfZxxrxbb"],
    ["Roadmap", "https://cuesoft.gitbook.io/upstat/product/roadmap"],
    ["CueLABS™", "https://cuelabs.cuesoft.io"],
  ],
  Legal: [
    ["Privacy", "https://privacy.cuesoft.io"],
    ["Terms", "https://terms.cuesoft.io"],
    ["Status", "https://status.cuesoft.io"],
  ],
};

describe("MarketingFooter (parity canon, SKILL.md 2026-07-19)", () => {
  it("renders the brand block and every canonical column link", () => {
    render(<MarketingFooter />);
    expect(screen.getByText(/MIT licensed/)).toBeInTheDocument();
    for (const [heading, links] of Object.entries(CANON)) {
      const column = screen.getByRole("navigation", { name: heading });
      for (const [label, href] of links) {
        expect(
          within(column).getByRole("link", { name: label }),
        ).toHaveAttribute("href", href);
      }
    }
  });

  it("legal bar: verbatim copyright with linked marks", () => {
    render(<MarketingFooter />);
    const bar = screen.getByText(/CueLABS™ Division/).closest("p")!;
    expect(bar).toHaveTextContent(
      "© Cuesoft Inc. 2026. Upstat. CueLABS™ Division. MIT License.",
    );
    expect(
      within(bar).getByRole("link", { name: "Cuesoft Inc." }),
    ).toHaveAttribute("href", "https://cuesoft.io");
    expect(
      within(bar).getByRole("link", { name: "CueLABS™ Division" }),
    ).toHaveAttribute("href", "https://cuelabs.cuesoft.io");
    expect(
      within(bar).getByRole("link", { name: "MIT License" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/cuesoftinc/upstat/blob/main/LICENSE",
    );
  });

  it("legal bar: language selector (English-only, real control) + security affordance", () => {
    render(<MarketingFooter />);
    const language = screen.getByRole("combobox", { name: "Language" });
    expect(language).toHaveValue("en");
    expect(within(language).getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute(
      "href",
      "https://github.com/cuesoftinc/upstat/blob/main/SECURITY.md",
    );
  });
});
