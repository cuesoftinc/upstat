import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ZoomStackChip } from "./ZoomStackChip";

describe("ZoomStackChip", () => {
  it("shows depth + range and resets (MI-3)", async () => {
    const onReset = vi.fn();
    render(<ZoomStackChip depth={2} label="09:12–09:40" onReset={onReset} />);
    expect(screen.getByText("×2")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Reset zoom"));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it("compacts below md — the range label collapses, depth + reset stay (390 TopBar)", () => {
    render(<ZoomStackChip depth={2} label="09:12–09:40" onReset={() => undefined} />);
    // browsers apply the breakpoint; the pin is the responsive classes
    expect(screen.getByText("09:12–09:40")).toHaveClass("hidden", "md:inline");
    expect(screen.getByText("×2")).not.toHaveClass("hidden");
    expect(screen.getByLabelText("Reset zoom")).toBeInTheDocument();
  });
});
