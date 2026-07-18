import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WidgetTypePicker, WIDGET_TYPES } from "./WidgetTypePicker";

describe("WidgetTypePicker", () => {
  it("renders the 11 pages.md B2 widget types and selects", async () => {
    const onSelect = vi.fn();
    render(<WidgetTypePicker layout="grid" onSelect={onSelect} />);
    expect(WIDGET_TYPES).toHaveLength(11);
    for (const t of WIDGET_TYPES) {
      expect(screen.getByRole("button", { name: t.label })).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole("button", { name: "Heatmap" }));
    expect(onSelect).toHaveBeenCalledWith("heatmap");
  });
});
