import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/design/ThemeProvider";
import { TopBar } from "./TopBar";

const renderBar = (props: Parameters<typeof TopBar>[0]) =>
  render(
    <ThemeProvider>
      <TopBar {...props} />
    </ThemeProvider>,
  );

describe("TopBar", () => {
  it("carries org switcher, search hint and unread bell (MI-14)", () => {
    renderBar({ orgName: "Upstat", unreadCount: 3 });
    expect(screen.getByText("Upstat")).toBeInTheDocument();
    expect(screen.getByText("Search…")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Notifications (3 unread)"),
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("keeps the bell calm without unread alerts", () => {
    renderBar({ orgName: "Upstat" });
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });

  it("carries the theme toggle in the utility area (parity canon)", () => {
    renderBar({ orgName: "Upstat" });
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
  });
});
