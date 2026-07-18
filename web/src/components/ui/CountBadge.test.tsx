import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BufferedCountChip, CountBadge } from "./CountBadge";

describe("CountBadge", () => {
  it("hides at zero and caps at 99+", () => {
    const { container, rerender } = render(<CountBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<CountBadge count={128} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});

describe("BufferedCountChip", () => {
  it("shows the ▼ n new affordance (MI-4)", async () => {
    const onClick = vi.fn();
    render(<BufferedCountChip count={128} onClick={onClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByText("128")).toBeInTheDocument();
  });
});
