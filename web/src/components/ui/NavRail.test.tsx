import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { House } from "lucide-react";
import { NavRail, NavRailItem, NAV_PILLARS } from "./NavRail";

describe("NavRail", () => {
  it("renders the 12 pillars with the active one marked", () => {
    render(<NavRail activeKey="logs" />);
    expect(NAV_PILLARS).toHaveLength(12);
    for (const pillar of NAV_PILLARS) {
      expect(screen.getByRole("button", { name: pillar.label })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Logs" })).toHaveAttribute("aria-current", "page");
  });

  it("navigates on click", async () => {
    const onNavigate = vi.fn();
    render(<NavRail activeKey="home" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole("button", { name: "Monitors" }));
    expect(onNavigate).toHaveBeenCalledWith("monitors");
  });
});

describe("NavRailItem", () => {
  it("shows the flyout label on hover", async () => {
    render(<NavRailItem icon={House} label="Home" />);
    expect(screen.queryByRole("tooltip")).toBeNull();
    await userEvent.hover(screen.getByRole("button", { name: "Home" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Home");
  });
});
