import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./Button";

describe("Button", () => {
  it("renders the three kinds with data-kind", () => {
    const { rerender } = render(<Button kind="brand">Save</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-kind", "brand");
    rerender(<Button kind="quiet">Save</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-kind", "quiet");
    rerender(<Button kind="destructive">Delete</Button>);
    expect(screen.getByRole("button")).toHaveAttribute(
      "data-kind",
      "destructive",
    );
  });

  it("blocks clicks when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Save
      </Button>,
    );
    await userEvent.click(screen.getByRole("button")).catch(() => undefined);
    expect(onClick).not.toHaveBeenCalled();
  });
});
