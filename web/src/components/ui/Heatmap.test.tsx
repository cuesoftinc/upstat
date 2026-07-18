import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Heatmap } from "./Heatmap";

describe("Heatmap", () => {
  it("renders the time×bucket cell grid", () => {
    render(
      <Heatmap
        columns={["09:00", "09:05"]}
        rows={["<100ms", "<500ms"]}
        values={[
          [1, 4],
          [2, 0],
        ]}
      />,
    );
    expect(screen.getByRole("img", { name: "heatmap" }).children).toHaveLength(4);
  });
});
