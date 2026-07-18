import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TopBar } from "./TopBar";

describe("TopBar", () => {
  it("carries org switcher, search hint and unread bell (MI-14)", () => {
    render(<TopBar orgName="Upstat" unreadCount={3} />);
    expect(screen.getByText("Upstat")).toBeInTheDocument();
    expect(screen.getByText("Search…")).toBeInTheDocument();
    expect(screen.getByLabelText("Notifications (3 unread)")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("keeps the bell calm without unread alerts", () => {
    render(<TopBar orgName="Upstat" />);
    expect(screen.getByLabelText("Notifications")).toBeInTheDocument();
  });
});
