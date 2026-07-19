import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryPill } from "./QueryPill";

describe("QueryPill", () => {
  it("renders facet:value and removes", async () => {
    const onRemove = vi.fn();
    render(
      <QueryPill facet="service" value="api-common" onRemove={onRemove} />,
    );
    expect(screen.getByText("service:")).toBeInTheDocument();
    await userEvent.click(
      screen.getByLabelText("Remove filter service:api-common"),
    );
    expect(onRemove).toHaveBeenCalledOnce();
  });

  it("marks negated filters", () => {
    render(<QueryPill facet="level" value="debug" negated />);
    expect(screen.getByText("-")).toHaveClass("text-crit");
  });
});
