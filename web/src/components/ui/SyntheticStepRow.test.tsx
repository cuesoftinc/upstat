import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SyntheticStepRow } from "./SyntheticStepRow";

describe("SyntheticStepRow", () => {
  it("renders index, kind chip and mono summary per kind", () => {
    const { rerender } = render(
      <SyntheticStepRow
        index={1}
        kind="http"
        summary="GET https://api.upstat.cuesoft.io/health"
      />,
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("HTTP")).toBeInTheDocument();
    expect(
      screen.getByText("GET https://api.upstat.cuesoft.io/health"),
    ).toBeInTheDocument();

    rerender(
      <SyntheticStepRow index={2} kind="assertion" summary="status == 200" />,
    );
    expect(screen.getByText("ASSERT")).toBeInTheDocument();

    rerender(<SyntheticStepRow index={3} kind="wait" summary="wait 500 ms" />);
    expect(screen.getByText("WAIT")).toBeInTheDocument();
    expect(screen.getByText("wait 500 ms")).toBeInTheDocument();
  });

  it("deletes via the trash affordance", () => {
    const onDelete = vi.fn();
    render(
      <SyntheticStepRow
        index={2}
        kind="assertion"
        summary="body.ok == true"
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete step 2" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("reorders with ArrowUp/ArrowDown on the grip", () => {
    const onMove = vi.fn();
    render(
      <SyntheticStepRow
        index={2}
        kind="wait"
        summary="wait 500 ms"
        onMove={onMove}
      />,
    );
    const grip = screen.getByRole("button", { name: "Reorder step 2" });
    fireEvent.keyDown(grip, { key: "ArrowUp" });
    expect(onMove).toHaveBeenCalledWith(-1);
    fireEvent.keyDown(grip, { key: "ArrowDown" });
    expect(onMove).toHaveBeenCalledWith(1);
  });
});
