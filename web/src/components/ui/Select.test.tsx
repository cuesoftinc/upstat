import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Select } from "./Select";

const OPTIONS = [
  { value: "utc", label: "UTC" },
  { value: "lagos", label: "Africa/Lagos" },
  { value: "berlin", label: "Europe/Berlin" },
];

describe("Select", () => {
  it("opens and commits a value", async () => {
    const onChange = vi.fn();
    render(
      <Select
        options={OPTIONS}
        value="utc"
        onValueChange={onChange}
        aria-label="tz"
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "tz" }));
    await userEvent.click(screen.getByRole("button", { name: "Africa/Lagos" }));
    expect(onChange).toHaveBeenCalledWith("lagos");
  });

  it("filters via type-ahead (IANA lists, X-10)", async () => {
    render(
      <Select
        options={OPTIONS}
        value={null}
        onValueChange={() => undefined}
        typeahead
        aria-label="tz"
      />,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "tz" }));
    await userEvent.type(screen.getByLabelText("Filter options"), "lag");
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Africa/Lagos")).toBeInTheDocument();
    expect(within(listbox).queryByText("UTC")).toBeNull();
  });
});
