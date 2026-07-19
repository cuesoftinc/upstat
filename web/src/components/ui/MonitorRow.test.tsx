import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonitorRow } from "./MonitorRow";

describe("MonitorRow", () => {
  it("carries status and mute toggle", async () => {
    const onMuted = vi.fn();
    render(
      <MonitorRow
        status="ok"
        name="Homepage"
        summary="https://upstat.cuesoft.io"
        muted={false}
        onMutedChange={onMuted}
      />,
    );
    await userEvent.click(
      screen.getByRole("switch", { name: "Mute Homepage" }),
    );
    expect(onMuted).toHaveBeenCalledWith(true);
  });

  it("dims when muted and shows — for never-triggered", () => {
    render(
      <MonitorRow status="paused" name="Blog" summary="https://blog" muted />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
