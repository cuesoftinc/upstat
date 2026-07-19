import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPageHeader } from "./StatusPageHeader";

describe("StatusPageHeader", () => {
  it("renders each overall state copy", () => {
    const { rerender } = render(
      <StatusPageHeader orgName="Upstat" overall="operational" lastUpdated="2026-07-18T12:00:00Z" />,
    );
    expect(screen.getByText("All systems operational")).toBeInTheDocument();
    rerender(
      <StatusPageHeader orgName="Upstat" overall="major_outage" lastUpdated="2026-07-18T12:00:00Z" />,
    );
    expect(screen.getByText("Major outage")).toBeInTheDocument();
  });
});

describe("StatusPageHeader — landing embed overrides (W2)", () => {
  it("omits the org heading when orgName is absent (135:471 embed)", () => {
    render(<StatusPageHeader overall="operational" lastUpdated="2026-07-18T12:00:00Z" />);
    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("renders a relative last-updated label when asked", () => {
    const twoMinAgo = new Date(Date.now() - 2 * 60_000).toISOString();
    render(
      <StatusPageHeader overall="operational" lastUpdated={twoMinAgo} updatedFormat="relative" />,
    );
    expect(screen.getByText(/Last updated\s+2m ago/)).toBeInTheDocument();
  });
});
