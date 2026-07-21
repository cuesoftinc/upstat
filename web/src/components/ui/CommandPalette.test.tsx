import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { CommandPalette } from "./CommandPalette";

const ITEMS = [
  { id: "1", label: "Service overview", kbd: "g d" },
  { id: "2", label: "Checkout health" },
];

describe("CommandPalette", () => {
  it("filters, selects, and closes", async () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <CommandPalette
        open
        onClose={onClose}
        items={ITEMS}
        onSelect={onSelect}
      />,
    );
    await userEvent.type(screen.getByLabelText("Search"), "checkout");
    await userEvent.click(
      screen.getByRole("option", { name: /Checkout health/ }),
    );
    expect(onSelect).toHaveBeenCalledWith(ITEMS[1]);
    expect(onClose).toHaveBeenCalled();
  });

  it("renders the no-results state", async () => {
    render(<CommandPalette open onClose={() => undefined} items={ITEMS} />);
    await userEvent.type(screen.getByLabelText("Search"), "zzz");
    expect(screen.getByText(/No results for/)).toBeInTheDocument();
  });

  // 2026-07-21 a11y audit: Escape was bound on the search input only —
  // once focus moved to an option the palette became un-dismissable.
  it("Escape closes from anywhere inside the dialog", async () => {
    const onClose = vi.fn();
    render(<CommandPalette open onClose={onClose} items={ITEMS} />);
    const option = screen.getByRole("option", { name: /Service overview/ });
    option.focus();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Command palette" }),
    ).toHaveAttribute("aria-modal", "true");
  });

  it("returns focus to the opener on close (fleet P4)", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open palette</button>
          <CommandPalette
            open={open}
            onClose={() => setOpen(false)}
            items={ITEMS}
          />
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole("button", { name: "Open palette" });
    await userEvent.click(opener);
    expect(screen.getByLabelText("Search")).toHaveFocus();
    await userEvent.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Command palette" }),
    ).toBeNull();
    expect(opener).toHaveFocus();
  });
});
