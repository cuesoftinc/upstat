import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
