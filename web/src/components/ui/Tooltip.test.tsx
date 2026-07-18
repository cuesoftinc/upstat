import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "./Tooltip";

describe("Tooltip", () => {
  it("shows multi-metric rows on hover (§8.2b)", async () => {
    render(
      <Tooltip content={[{ label: "error", value: "1.2%" }]}>
        <span>target</span>
      </Tooltip>,
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
    await userEvent.hover(screen.getByText("target"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("error");
    expect(screen.getByRole("tooltip")).toHaveTextContent("1.2%");
  });

  it("shows plain text content", async () => {
    render(
      <Tooltip content="hello">
        <span>t</span>
      </Tooltip>,
    );
    await userEvent.hover(screen.getByText("t"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("hello");
  });
});
