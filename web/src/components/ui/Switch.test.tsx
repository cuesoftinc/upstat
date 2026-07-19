import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Switch } from "./Switch";

describe("Switch", () => {
  it("toggles via role=switch", async () => {
    const onChange = vi.fn();
    render(
      <Switch checked={false} onCheckedChange={onChange} aria-label="Mute" />,
    );
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("blocks toggling while disabled", async () => {
    const onChange = vi.fn();
    render(
      <Switch checked disabled onCheckedChange={onChange} aria-label="Mute" />,
    );
    await userEvent.click(screen.getByRole("switch")).catch(() => undefined);
    expect(onChange).not.toHaveBeenCalled();
  });
});
