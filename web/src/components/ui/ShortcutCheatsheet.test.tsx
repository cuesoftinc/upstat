import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShortcutCheatsheet } from "./ShortcutCheatsheet";

describe("ShortcutCheatsheet", () => {
  it("renders the MI-17 keyboard map when open", () => {
    render(<ShortcutCheatsheet open />);
    expect(
      screen.getByRole("dialog", { name: "Keyboard shortcuts" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Go to dashboards")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<ShortcutCheatsheet open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("closes on Escape (MI-17 — keyboard users aren't trapped)", async () => {
    const onClose = vi.fn();
    render(<ShortcutCheatsheet open onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
