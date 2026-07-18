import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { House } from "lucide-react";
import { CommandPalette } from "./CommandPalette";
import { NavRail, NavRailItem, NAV_PILLARS } from "./NavRail";
import { ShortcutCheatsheet } from "./ShortcutCheatsheet";
import { TopBar } from "./TopBar";

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

describe("TopBar", () => {
  it("carries org switcher, search hint and unread bell (MI-14)", () => {
    render(<TopBar orgName="Upstat" unreadCount={3} />);
    expect(screen.getByText("Upstat")).toBeInTheDocument();
    expect(screen.getByText("Search…")).toBeInTheDocument();
    expect(screen.getByLabelText("Notifications (3 unread)")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

describe("CommandPalette", () => {
  const ITEMS = [
    { id: "1", label: "Service overview", kbd: "g d" },
    { id: "2", label: "Checkout health" },
  ];

  it("filters, selects, and shows no-results", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} items={ITEMS} onSelect={onSelect} />);
    const input = screen.getByLabelText("Search");
    await userEvent.type(input, "checkout");
    await userEvent.click(screen.getByRole("option", { name: /Checkout health/ }));
    expect(onSelect).toHaveBeenCalledWith(ITEMS[1]);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders the empty result state", async () => {
    render(<CommandPalette open onClose={() => undefined} items={ITEMS} />);
    await userEvent.type(screen.getByLabelText("Search"), "zzz");
    expect(screen.getByText(/No results for/)).toBeInTheDocument();
  });
});

describe("ShortcutCheatsheet", () => {
  it("renders the MI-17 keyboard map when open", () => {
    render(<ShortcutCheatsheet open />);
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByText("Go to dashboards")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<ShortcutCheatsheet open={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
