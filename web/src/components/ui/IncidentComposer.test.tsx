import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IncidentComposer } from "./IncidentComposer";

describe("IncidentComposer", () => {
  it("autocompletes slash commands (MI-10)", async () => {
    render(<IncidentComposer onSubmit={() => undefined} />);
    await userEvent.type(screen.getByLabelText("Incident update"), "/sta");
    expect(
      screen.getByRole("listbox", { name: "Slash commands" }),
    ).toBeInTheDocument();
    expect(screen.getByText("/status resolved")).toBeInTheDocument();
  });

  it("parses /status into the submitted phase", async () => {
    const onSubmit = vi.fn();
    render(<IncidentComposer onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Incident update");
    await userEvent.type(input, "/status resolved all clear");
    await userEvent.click(screen.getByRole("button", { name: "Post update" }));
    expect(onSubmit).toHaveBeenCalledWith({
      body: "/status resolved all clear",
      phase: "resolved",
    });
  });
});
