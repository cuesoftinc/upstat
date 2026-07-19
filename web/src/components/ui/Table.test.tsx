import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Table } from "./Table";

describe("Table", () => {
  it("right-aligns numeric columns in mono", () => {
    render(
      <Table
        columns={[
          { key: "svc", label: "Service" },
          { key: "p95", label: "p95", numeric: true },
        ]}
        rows={[{ svc: "web", p95: 142 }]}
      />,
    );
    expect(screen.getByText("142")).toHaveClass("text-right", "font-data");
  });

  it("renders — for null cells", () => {
    render(<Table columns={[{ key: "a", label: "A" }]} rows={[{ a: null }]} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
