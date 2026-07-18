import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GoogleAuthButton } from "./GoogleAuthButton";

describe("GoogleAuthButton", () => {
  it("renders the single Google CTA copy", () => {
    render(<GoogleAuthButton />);
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });

  it("fires onClick", async () => {
    const onClick = vi.fn();
    render(<GoogleAuthButton onClick={onClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("shows the loading state and blocks interaction", async () => {
    const onClick = vi.fn();
    render(<GoogleAuthButton onClick={onClick} loading />);
    const button = screen.getByRole("button", { name: /connecting/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    await userEvent.click(button).catch(() => undefined);
    expect(onClick).not.toHaveBeenCalled();
  });
});
