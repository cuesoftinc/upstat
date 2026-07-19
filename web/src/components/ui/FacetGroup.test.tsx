import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FacetGroup } from "./FacetGroup";

describe("FacetGroup", () => {
  it("toggles facets and collapses", async () => {
    const onToggle = vi.fn();
    render(
      <FacetGroup
        name="service"
        values={[{ value: "web", count: 12 }]}
        selected={[]}
        onToggle={onToggle}
      />,
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "service: web" }),
    );
    expect(onToggle).toHaveBeenCalledWith("web");
    await userEvent.click(screen.getByRole("button", { name: /service/i }));
    expect(screen.queryByText("web")).toBeNull();
  });

  it("shows top-N then expands to all", async () => {
    const values = Array.from({ length: 8 }, (_, i) => ({
      value: `svc-${i}`,
      count: i,
    }));
    render(
      <FacetGroup
        name="service"
        values={values}
        selected={[]}
        onToggle={() => undefined}
        topN={3}
      />,
    );
    expect(screen.queryByText("svc-5")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Show all 8" }));
    expect(screen.getByText("svc-5")).toBeInTheDocument();
  });
});
