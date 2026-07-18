import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AlertEvent } from "@/models";
import { AlertFeedRow, NotificationPopover } from "./AlertFeedRow";

const EVENT: AlertEvent = {
  id: "evt_1",
  ts: "2026-07-18T09:00:00Z",
  sev: "sev1",
  rule_id: "rule_1",
  monitor_name: "Checkout p95 latency",
  message: "p95 2,412 ms breached crit 1,500 ms",
  unread: true,
};

describe("AlertFeedRow", () => {
  it("carries sev tint + unread state", () => {
    render(<AlertFeedRow event={EVENT} />);
    const row = screen.getByRole("button");
    expect(row).toHaveAttribute("data-sev", "sev1");
    expect(row).toHaveAttribute("data-unread", "true");
  });

  it("renders the resolved tint calm (decided 2026-07-17)", () => {
    render(<AlertFeedRow event={{ ...EVENT, sev: "resolved", unread: false }} />);
    const row = screen.getByRole("button");
    expect(row).toHaveAttribute("data-sev", "resolved");
    expect(row).not.toHaveAttribute("data-unread");
  });
});

describe("NotificationPopover", () => {
  it("shows the empty state", () => {
    render(<NotificationPopover events={[]} />);
    expect(screen.getByText("Nothing triggered. Calm seas.")).toBeInTheDocument();
  });

  it("lists feed rows when events exist", () => {
    render(<NotificationPopover events={[EVENT]} />);
    expect(screen.getByText(EVENT.monitor_name)).toBeInTheDocument();
  });
});
