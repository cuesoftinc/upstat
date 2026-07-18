import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommandPalette } from "./CommandPalette";

const ITEMS = [
  { id: "1", label: "Service overview", kbd: "g d" },
  { id: "2", label: "Checkout health" },
];

describe("CommandPalette", () => {
  it("filters, selects, and closes", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} items={ITEMS} onSelect={onSelect} />);
    await userEvent.type(screen.getByLabelText("Search"), "checkout");
    await userEvent.click(screen.getByRole("option", { name: /Checkout health/ }));
    expect(onSelect).toHaveBeenCalledWith(ITEMS[1]);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders the no-results state", async () => {
    render(<CommandPalette open onClose={() => undefined} items={ITEMS} />);
    await userEvent.type(screen.getByLabelText("Search"), "zzz");
    expect(screen.getByText(/No results for/)).toBeInTheDocument();
  });
});
