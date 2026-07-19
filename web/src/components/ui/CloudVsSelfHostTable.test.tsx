import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CloudVsSelfHostTable } from "./CloudVsSelfHostTable";

describe("CloudVsSelfHostTable", () => {
  it("renders plan columns with per-column CTAs (A9)", () => {
    render(<CloudVsSelfHostTable />);
    expect(screen.getByText("MIT-licensed source")).toBeInTheDocument();
    expect(screen.getByText("Managed upgrades & backups")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Cloud" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Self Host" })).toBeInTheDocument();
  });
});

describe("CloudVsSelfHostTable — landing instance overrides (Figma 135:688)", () => {
  it("takes header + CTA overrides without touching defaults", () => {
    render(
      <CloudVsSelfHostTable
        rows={[{ feature: "Managed OTLP ingestion", cloud: true, selfHost: false }]}
        featureHeader=""
        cloudHeader="Upstat Cloud"
        selfHostCta="Deploy with compose"
      />,
    );
    expect(screen.getByText("Upstat Cloud")).toBeInTheDocument();
    expect(screen.getByText("Managed OTLP ingestion")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deploy with compose" })).toBeInTheDocument();
  });
});
