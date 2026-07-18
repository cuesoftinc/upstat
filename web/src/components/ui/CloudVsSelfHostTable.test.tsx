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
