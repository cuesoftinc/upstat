import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Avatar, AvatarStack } from "./Avatar";

describe("Avatar", () => {
  it("falls back to initials", () => {
    render(<Avatar name="Ibukun Dairo" />);
    expect(screen.getByText("ID")).toBeInTheDocument();
  });

  it("renders the image variant when src is given", () => {
    render(<Avatar name="Kemi" src="https://example.com/kemi.png" />);
    expect(screen.getByAltText("Kemi")).toBeInTheDocument();
  });
});

describe("AvatarStack", () => {
  it("overflows into +n", () => {
    render(<AvatarStack names={["A", "B", "C", "D"]} max={2} />);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});
