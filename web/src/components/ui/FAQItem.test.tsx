import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FAQItem } from "./FAQItem";

describe("FAQItem", () => {
  it("expands and collapses (single-open orchestrated by parent)", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <FAQItem
        question="Is everything open-source?"
        answer="Yes — MIT."
        expanded={false}
        onToggle={onToggle}
      />,
    );
    expect(screen.queryByText("Yes — MIT.")).toBeNull();
    await userEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(
      <FAQItem
        question="Is everything open-source?"
        answer="Yes — MIT."
        expanded
        onToggle={onToggle}
      />,
    );
    expect(screen.getByText("Yes — MIT.")).toBeInTheDocument();
  });
});
