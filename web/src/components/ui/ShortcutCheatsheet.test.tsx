import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ShortcutCheatsheet } from "./ShortcutCheatsheet";

describe("ShortcutCheatsheet", () => {
  it("renders the MI-17 keyboard map when open", () => {
    render(<ShortcutCheatsheet open />);
    expect(screen.getByRole("dialog", { name: "Keyboard shortcuts" })).toBeInTheDocument();
    expect(screen.getByText("Go to dashboards")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    const { container } = render(<ShortcutCheatsheet open={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});
