import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Table2 } from "lucide-react";
import { WidgetTypeCell } from "./WidgetTypeCell";

describe("WidgetTypeCell", () => {
  it("renders the icon + label tile and reports selection", async () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <WidgetTypeCell icon={Table2} label="Table" onClick={onClick} />,
    );
    const tile = screen.getByRole("button", { name: "Table" });
    expect(tile).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(tile);
    expect(onClick).toHaveBeenCalledOnce();
    rerender(<WidgetTypeCell icon={Table2} label="Table" selected />);
    expect(screen.getByRole("button", { name: "Table" })).toHaveAttribute("aria-pressed", "true");
  });
});
