import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LogHistogram } from "./LogHistogram";

describe("LogHistogram", () => {
  it("stacks level counts per bucket", () => {
    render(
      <LogHistogram
        buckets={[
          {
            ts: "2026-07-18T09:00:00Z",
            counts: { INFO: 10, DEBUG: 2, WARN: 1, ERROR: 5, TRACE: 0 },
          },
        ]}
      />,
    );
    expect(
      screen.getByRole("img", { name: "log volume histogram" }),
    ).toBeInTheDocument();
    expect(screen.getByText("18 lines")).toBeInTheDocument();
  });
});
