import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MarketingFooter } from "./MarketingFooter";

describe("MarketingFooter", () => {
  it("links privacy per UPS-005", () => {
    render(<MarketingFooter />);
    expect(screen.getByRole("link", { name: "Privacy (cookieless)" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByText(/MIT licensed/)).toBeInTheDocument();
  });
});

describe("MarketingFooter — landing variant (Figma 135:770)", () => {
  it("renders inline dot-joined columns + copyright, no brand block", () => {
    render(
      <MarketingFooter
        inline
        showBrand={false}
        copyright="© 2026 Cuesoft · upstat is CueLABS open source"
        columns={[
          { heading: "Product", links: [{ label: "Uptime", href: "/#pillars" }, { label: "Logs", href: "/#pillars" }] },
        ]}
      />,
    );
    expect(screen.getByText("© 2026 Cuesoft · upstat is CueLABS open source")).toBeInTheDocument();
    expect(screen.queryByText(/MIT licensed/)).toBeNull();
    expect(screen.getByRole("link", { name: "Uptime" })).toHaveAttribute("href", "/#pillars");
  });
});
