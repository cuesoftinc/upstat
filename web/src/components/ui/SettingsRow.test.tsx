import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SettingsRow } from "./SettingsRow";
import { Switch } from "./Switch";

describe("SettingsRow", () => {
  it("hosts a control slot", () => {
    render(
      <SettingsRow
        label="Timezone"
        description="IANA — display only"
        control={<Switch checked aria-label="control" />}
      />,
    );
    expect(screen.getByText("Timezone")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "control" })).toBeInTheDocument();
  });

  it("dims the disabled state", () => {
    const { container } = render(
      <SettingsRow label="Retention" control={<span>90d</span>} disabled />,
    );
    expect(container.querySelector('[data-disabled="true"]')).not.toBeNull();
  });

  it("disabled gates the control slot — embedded controls go inert (review class 2026-07-19)", () => {
    // browsers enforce `inert` (unfocusable, unclickable, out of the a11y
    // tree); the assertion pins the attribute on the slot wrapper
    render(
      <SettingsRow
        label="Retention override"
        control={<button type="button">change</button>}
        disabled
      />,
    );
    expect(screen.getByText("change").closest("[inert]")).not.toBeNull();
  });

  it("keeps the control slot live when enabled", () => {
    render(<SettingsRow label="Digest" control={<button type="button">edit</button>} />);
    expect(screen.getByRole("button", { name: "edit" }).closest("[inert]")).toBeNull();
  });
});
