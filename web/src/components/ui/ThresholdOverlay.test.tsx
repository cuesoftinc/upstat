import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ThresholdOverlay } from "./ThresholdOverlay";

describe("ThresholdOverlay", () => {
  it("draws bands and would-have-fired markers (MI-9)", () => {
    const { container } = render(
      <ThresholdOverlay warnFrom={0.5} critFrom={0.8} markers={[0.3, 0.6]} />,
    );
    expect(container.querySelector('[data-band="warn"]')).not.toBeNull();
    expect(container.querySelector('[data-band="crit"]')).not.toBeNull();
    expect(container.querySelectorAll("[data-marker]")).toHaveLength(2);
  });
});
