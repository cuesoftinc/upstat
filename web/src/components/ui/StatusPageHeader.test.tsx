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
