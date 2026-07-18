import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toast } from "./Toast";

describe("Toast", () => {
  it("renders each kind and dismisses", async () => {
    const onDismiss = vi.fn();
    render(<Toast kind="error" message="Something failed" onDismiss={onDismiss} />);
    expect(screen.getByRole("status")).toHaveAttribute("data-kind", "error");
    await userEvent.click(screen.getByLabelText("Dismiss"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("renders info and success kinds", () => {
    const { rerender } = render(<Toast kind="info" message="FYI" />);
    expect(screen.getByRole("status")).toHaveAttribute("data-kind", "info");
    rerender(<Toast kind="success" message="Saved" />);
    expect(screen.getByRole("status")).toHaveAttribute("data-kind", "success");
  });
});
