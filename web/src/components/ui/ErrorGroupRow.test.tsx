import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ErrorGroupRow } from "./ErrorGroupRow";

describe("ErrorGroupRow", () => {
  it("renders fingerprint message, count and state", () => {
    render(
      <ErrorGroupRow
        group={{
          fingerprint: "fe4a9d21",
          message: "TypeError: Cannot read properties of undefined",
          count: 128,
          first_seen: "2026-07-12T00:00:00Z",
          last_seen: "2026-07-18T11:42:00Z",
          state: "regressed",
          sparkline: [1, 4, 2, 8],
        }}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute(
      "data-state",
      "regressed",
    );
    expect(screen.getByText("128")).toBeInTheDocument();
  });
});
