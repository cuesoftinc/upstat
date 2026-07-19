import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  COLOR_VISION_STORAGE_KEY,
  ColorVisionProvider,
  colorVisionInitScript,
  patternFillStyle,
  seriesDash,
  useColorVision,
} from "./ColorVisionProvider";

function Probe() {
  const { mode, patterns, setMode } = useColorVision();
  return (
    <button
      type="button"
      onClick={() => setMode(patterns ? "default" : "patterns")}
    >
      mode:{mode}
    </button>
  );
}

describe("ColorVisionProvider (design.md §5 colorblind mode, upstat.colorvision)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-colorvision");
  });

  it("defaults off when unset", () => {
    render(
      <ColorVisionProvider>
        <Probe />
      </ColorVisionProvider>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("mode:default");
    expect(document.documentElement).not.toHaveAttribute("data-colorvision");
  });

  it("patterns: sets data-colorvision on <html> and persists under upstat.colorvision", async () => {
    render(
      <ColorVisionProvider>
        <Probe />
      </ColorVisionProvider>,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toHaveTextContent("mode:patterns");
    expect(document.documentElement).toHaveAttribute(
      "data-colorvision",
      "patterns",
    );
    expect(window.localStorage.getItem(COLOR_VISION_STORAGE_KEY)).toBe(
      "patterns",
    );

    // and back: default clears the attribute AND the storage entry
    await userEvent.click(screen.getByRole("button"));
    expect(document.documentElement).not.toHaveAttribute("data-colorvision");
    expect(window.localStorage.getItem(COLOR_VISION_STORAGE_KEY)).toBeNull();
  });

  it("reads a persisted patterns preference", () => {
    window.localStorage.setItem(COLOR_VISION_STORAGE_KEY, "patterns");
    render(
      <ColorVisionProvider>
        <Probe />
      </ColorVisionProvider>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("mode:patterns");
  });

  it("is safe without a provider (default off) — leaf charts render alone", () => {
    render(<Probe />);
    expect(screen.getByRole("button")).toHaveTextContent("mode:default");
  });

  it("init script carries the canonical storage key and attribute literally", () => {
    expect(colorVisionInitScript).toContain(`"${COLOR_VISION_STORAGE_KEY}"`);
    expect(colorVisionInitScript).toContain('"data-colorvision"');
    expect(colorVisionInitScript).toContain('"patterns"');
  });
});

describe("pattern styling helpers (§5)", () => {
  it("seriesDash: index 0 solid, others distinct, cycles at 8", () => {
    expect(seriesDash(0)).toBe("");
    const dashes = Array.from({ length: 8 }, (_, i) => seriesDash(i));
    expect(new Set(dashes).size).toBe(8);
    expect(seriesDash(8)).toBe(seriesDash(0));
  });

  it("patternFillStyle: index 0 stays solid; others gain a stripe overlay", () => {
    expect(patternFillStyle("red", 0)).toEqual({ background: "red" });
    const striped = patternFillStyle("red", 3);
    expect(striped.backgroundColor).toBe("red");
    expect(striped.backgroundImage).toMatch(/repeating-linear-gradient/);
    // angles/pitches differ across indices
    expect(patternFillStyle("red", 1).backgroundImage).not.toBe(
      patternFillStyle("red", 2).backgroundImage,
    );
  });
});
