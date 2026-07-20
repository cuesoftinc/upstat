import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TimePicker } from "./TimePicker";

describe("TimePicker", () => {
  it("selects presets and toggles live", async () => {
    const onChange = vi.fn();
    const onLive = vi.fn();
    render(
      <TimePicker
        value="1h"
        onChange={onChange}
        live={false}
        onLiveChange={onLive}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "4h" }));
    expect(onChange).toHaveBeenCalledWith("4h");
    // master casing: the live toggle reads "LIVE"
    await userEvent.click(screen.getByRole("button", { name: "LIVE" }));
    expect(onLive).toHaveBeenCalledWith(true);
  });

  it("opens the absolute-range panel on custom", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<TimePicker value="1h" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Custom range" }));
    expect(onChange).toHaveBeenCalledWith("custom");
    rerender(<TimePicker value="custom" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Custom range" }));
    expect(
      screen.getByRole("dialog", { name: "Absolute range" }),
    ).toBeInTheDocument();
  });

  it("absolute-range panel carries the master anatomy — from/to inputs + Apply range commit (43:59)", async () => {
    const onChange = vi.fn();
    render(<TimePicker value="custom" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Custom range" }));
    const dialog = screen.getByRole("dialog", { name: "Absolute range" });
    // the master's row is unlabeled mono inputs — aria-only names
    expect(within(dialog).getByLabelText("From")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("To")).toBeInTheDocument();
    // Apply range commits "custom" and closes the panel
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Apply range" }),
    );
    expect(onChange).toHaveBeenLastCalledWith("custom");
    expect(
      screen.queryByRole("dialog", { name: "Absolute range" }),
    ).not.toBeInTheDocument();
  });
});
