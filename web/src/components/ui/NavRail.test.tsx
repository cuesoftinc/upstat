import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { House } from "lucide-react";
import { NavRail, NavRailItem, NAV_PILLARS, NAV_SECTIONS } from "./NavRail";

describe("NavRail", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

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

  /* [Directive 2026-07-19] expandable rail — design.md §2 */

  it("sections cover every pillar in B order (Telemetry/Respond/Platform)", () => {
    expect(NAV_SECTIONS.map((s) => s.title)).toEqual([null, "Telemetry", "Respond", "Platform"]);
    expect(NAV_SECTIONS.flatMap((s) => s.keys)).toEqual(NAV_PILLARS.map((p) => p.key));
  });

  it("foot toggle expands the rail: aria-expanded, labels + group headers", async () => {
    render(<NavRail activeKey="home" />);
    const toggle = screen.getByTestId("rail-toggle");
    // jsdom matchMedia is non-matching → collapsed default (viewport <1280)
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Telemetry")).toBeNull();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    for (const title of ["Telemetry", "Respond", "Platform"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    // labels render inline (visible text, not just the aria-label)
    expect(screen.getByText("Dashboards")).toBeInTheDocument();
  });

  it("persists the expansion choice under nav.rail.expanded", async () => {
    const { unmount } = render(<NavRail activeKey="home" />);
    await userEvent.click(screen.getByTestId("rail-toggle"));
    expect(window.localStorage.getItem("nav.rail.expanded")).toBe("1");
    unmount();

    render(<NavRail activeKey="home" />);
    // stored choice resolves a tick after mount (deferred effect)
    await waitFor(() =>
      expect(screen.getByTestId("rail-toggle")).toHaveAttribute("aria-expanded", "true"),
    );
  });

  it("honors a stored collapsed choice over the viewport default", () => {
    window.localStorage.setItem("nav.rail.expanded", "0");
    render(<NavRail activeKey="home" />);
    expect(screen.getByTestId("rail-toggle")).toHaveAttribute("aria-expanded", "false");
  });
});

describe("NavRailItem", () => {
  it("shows the flyout label on hover", async () => {
    render(<NavRailItem icon={House} label="Home" />);
    expect(screen.queryByRole("tooltip")).toBeNull();
    await userEvent.hover(screen.getByRole("button", { name: "Home" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Home");
  });

  it("expanded rows carry the inline label and never the flyout", async () => {
    render(<NavRailItem icon={House} label="Home" expanded />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    await userEvent.hover(screen.getByRole("button", { name: "Home" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
