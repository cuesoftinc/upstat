import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { StepResultRow } from "./StepResultRow";

describe("StepResultRow", () => {
  it("renders PASS with a brand duration bar and fixed-precision ms", () => {
    render(
      <StepResultRow
        index={1}
        kind="http"
        summary="GET https://api.upstat.cuesoft.io/health"
        result="pass"
        durationMs={142}
        durationFraction={0.31}
      />,
    );
    expect(screen.getByText("PASS")).toBeInTheDocument();
    expect(screen.getByText("142 ms")).toBeInTheDocument();
    const row = screen.getByText("PASS").closest("[data-result]");
    expect(row).toHaveAttribute("data-result", "pass");
    expect(row?.querySelector(".bg-brand")).not.toBeNull();
  });

  it("renders FAIL with a crit bar and the assert prefix", () => {
    render(
      <StepResultRow
        index={3}
        kind="assertion"
        summary="body.ok == true"
        result="fail"
        durationMs={462}
        durationFraction={1}
      />,
    );
    expect(screen.getByText("FAIL")).toBeInTheDocument();
    expect(screen.getByText("assert body.ok == true")).toBeInTheDocument();
    const row = screen.getByText("FAIL").closest("[data-result]");
    expect(row?.querySelector(".bg-crit")).not.toBeNull();
  });

  it("width tracks the duration fraction with a visibility floor", () => {
    render(
      <StepResultRow
        index={2}
        kind="assertion"
        summary="status == 200"
        result="pass"
        durationMs={88}
        durationFraction={0.01}
      />,
    );
    const bar = document.querySelector(
      "[data-result] .bg-brand",
    ) as HTMLElement;
    expect(bar.style.width).toBe("4%"); // floored so tiny steps stay visible
  });
});
