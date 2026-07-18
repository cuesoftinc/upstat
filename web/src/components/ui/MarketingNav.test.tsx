import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketingNav } from "./MarketingNav";

describe("MarketingNav", () => {
  it("keeps the star badge neutral without a runtime count (A13)", () => {
    render(<MarketingNav />);
    const badge = screen.getByRole("link", { name: /Star/ });
    expect(badge).toHaveTextContent(/^Star$/);
  });

  it("shows the runtime star count when provided", () => {
    render(<MarketingNav starCount={1284} />);
    expect(screen.getByText("1,284")).toBeInTheDocument();
  });

  it("opens the pillar dropdown as a mini feature map ×8 (A1)", async () => {
    render(<MarketingNav />);
    await userEvent.click(screen.getByRole("button", { name: "Platform" }));
    const menu = screen.getByRole("menu", { name: "Platform pillars" });
    expect(menu.querySelectorAll("[data-pillar]")).toHaveLength(8);
  });
});
