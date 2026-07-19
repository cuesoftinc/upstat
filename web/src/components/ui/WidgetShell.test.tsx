import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WidgetShell } from "./WidgetShell";

describe("WidgetShell", () => {
  it("opens the ⋯ menu and enters fullscreen; ESC exits (MI-11/12)", async () => {
    const onMode = vi.fn();
    const { rerender } = render(
      <WidgetShell title="Errors" mode="view" onModeChange={onMode}>
        chart
      </WidgetShell>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Widget menu for Errors" }),
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Fullscreen" }));
    expect(onMode).toHaveBeenCalledWith("fullscreen");
    rerender(
      <WidgetShell title="Errors" mode="fullscreen" onModeChange={onMode}>
        chart
      </WidgetShell>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onMode).toHaveBeenCalledWith("view");
  });

  it("shows the drag handle only in edit mode", () => {
    const { rerender } = render(
      <WidgetShell title="Errors" mode="edit">
        chart
      </WidgetShell>,
    );
    expect(screen.getByLabelText("Drag to move")).toBeInTheDocument();
    rerender(
      <WidgetShell title="Errors" mode="view">
        chart
      </WidgetShell>,
    );
    expect(screen.queryByLabelText("Drag to move")).toBeNull();
  });
});
