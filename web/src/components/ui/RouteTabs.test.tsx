import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouteTabs } from "./RouteTabs";

let pathname = "/dashboard/settings/general";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

const TABS = [
  { href: "/dashboard/settings/general", label: "General" },
  { href: "/dashboard/settings/keys", label: "Keys & properties" },
  { href: "/dashboard/settings/usage", label: "Usage" },
];

const renderTabs = () =>
  render(
    <RouteTabs tabs={TABS} aria-label="Settings sections">
      <p>Pane content</p>
    </RouteTabs>,
  );

describe("RouteTabs (accessible routed-tabs pattern)", () => {
  beforeEach(() => {
    pathname = "/dashboard/settings/general";
  });

  it("renders link tabs in a labelled tablist, marking the active route", () => {
    renderTabs();
    expect(
      screen.getByRole("tablist", { name: "Settings sections" }),
    ).toBeInTheDocument();

    const active = screen.getByRole("tab", { name: "General" });
    expect(active).toHaveAttribute("href", TABS[0].href);
    expect(active).toHaveAttribute("aria-selected", "true");
    expect(active).toHaveAttribute("aria-current", "page");
    expect(active).toHaveAttribute("tabindex", "0");

    const inactive = screen.getByRole("tab", { name: "Usage" });
    expect(inactive).toHaveAttribute("aria-selected", "false");
    expect(inactive).not.toHaveAttribute("aria-current");
    expect(inactive).toHaveAttribute("tabindex", "-1");
  });

  it("labels the tabpanel by the active tab and renders the pane", () => {
    renderTabs();
    const panel = screen.getByRole("tabpanel");
    const active = screen.getByRole("tab", { name: "General" });
    expect(panel).toHaveAttribute("aria-labelledby", active.id);
    expect(panel).toHaveTextContent("Pane content");
  });

  it("keeps the active tab marked on deeper sub-paths", () => {
    pathname = "/dashboard/settings/keys/anything";
    renderTabs();
    expect(
      screen.getByRole("tab", { name: "Keys & properties" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("moves focus with arrows/Home/End (manual activation, wrapping)", async () => {
    const user = userEvent.setup();
    renderTabs();
    const [general, keys, usage] = TABS.map((tab) =>
      screen.getByRole("tab", { name: tab.label }),
    );

    general.focus();
    await user.keyboard("{ArrowRight}");
    expect(keys).toHaveFocus();
    await user.keyboard("{End}");
    expect(usage).toHaveFocus();
    // wraps past the last tab
    await user.keyboard("{ArrowRight}");
    expect(general).toHaveFocus();
    await user.keyboard("{ArrowLeft}");
    expect(usage).toHaveFocus();
    await user.keyboard("{Home}");
    expect(general).toHaveFocus();
    // focus travel alone never navigates — the active tab is unchanged
    expect(general).toHaveAttribute("aria-current", "page");
  });
});
