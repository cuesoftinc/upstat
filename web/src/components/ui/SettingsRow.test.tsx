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
});
