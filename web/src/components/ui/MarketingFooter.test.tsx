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
