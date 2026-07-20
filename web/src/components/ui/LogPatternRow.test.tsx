import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { LogEvent } from "@/models";
import { LogPatternRow } from "./LogPatternRow";

const SAMPLE: LogEvent = {
  id: "log_1",
  ts: "2026-07-20T11:59:58.100Z",
  service: "api-common",
  level: "ERROR",
  host: "gcp-lagos-1",
  message: "request failed method=POST path=/v1/events status=503",
  attrs: { env: "prod" },
};

describe("LogPatternRow", () => {
  it("renders count, dominant level and the template with dimmed placeholders", () => {
    render(
      <LogPatternRow
        template="request failed method=POST path=<path> status=<num>"
        count={12400}
        dominantLevel="ERROR"
        trend={[1, 2, 3, 4, 5, 6, 7]}
        samples={[SAMPLE]}
      />,
    );
    expect(screen.getByText("12.4k")).toBeInTheDocument();
    expect(screen.getByText("ERROR")).toBeInTheDocument();
    expect(screen.getByText("<path>")).toBeInTheDocument();
    expect(screen.getByText("<num>")).toBeInTheDocument();
    // collapsed by default
    expect(screen.getByRole("button", { expanded: false })).toBeInTheDocument();
    expect(screen.queryByLabelText("Sample lines")).not.toBeInTheDocument();
  });

  it("expands to indented sample LogLines", () => {
    render(
      <LogPatternRow
        template="request failed method=POST path=<path> status=<num>"
        count={204}
        dominantLevel="ERROR"
        trend={[0, 0, 1, 9, 4, 2, 1]}
        samples={[SAMPLE]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { expanded: false }));
    const samples = screen.getByLabelText("Sample lines");
    expect(samples).toBeInTheDocument();
    expect(samples.textContent).toContain(
      "request failed method=POST path=/v1/events status=503",
    );
  });

  it("draws one sparkline bar per trend bucket", () => {
    const { container } = render(
      <LogPatternRow
        template="wait <num> ms"
        count={7}
        dominantLevel="DEBUG"
        trend={[1, 1, 1, 1, 1, 1, 1]}
        samples={[]}
      />,
    );
    expect(container.querySelectorAll("svg rect")).toHaveLength(7);
  });
});
