import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IncidentHistoryEntry } from "./IncidentHistoryEntry";

describe("IncidentHistoryEntry", () => {
  it("renders phased, timestamped updates", () => {
    render(
      <IncidentHistoryEntry
        title="INC-42 — Checkout 5xx spike"
        updates={[
          {
            ts: "2026-07-18T09:00:00Z",
            phase: "investigating",
            body: "Declared.",
          },
          {
            ts: "2026-07-18T09:45:00Z",
            phase: "monitoring",
            body: "Throttle applied.",
          },
        ]}
      />,
    );
    expect(screen.getByText("investigating")).toBeInTheDocument();
    expect(screen.getByText("monitoring")).toBeInTheDocument();
  });
});
