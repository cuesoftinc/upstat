import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryBar } from "./QueryBar";

describe("QueryBar", () => {
  it("renders pills and surfaces syntax errors (MI-13)", () => {
    render(
      <QueryBar
        pills={[{ facet: "service", value: "web" }]}
        text="serivce:web"
        onTextChange={() => undefined}
        syntaxError="unknown facet: serivce"
      />,
    );
    expect(screen.getByText("service:")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("unknown facet");
    expect(screen.getByLabelText("Query")).toHaveAttribute("aria-invalid", "true");
  });

  it("opens autocomplete and picks a suggestion", async () => {
    const onPick = vi.fn();
    render(
      <QueryBar
        pills={[]}
        text="ser"
        onTextChange={() => undefined}
        suggestions={[{ text: "service:", cardinality: 7 }]}
        onPickSuggestion={onPick}
      />,
    );
    await userEvent.click(screen.getByLabelText("Query"));
    await userEvent.click(screen.getByRole("button", { name: /service: 7/ }));
    expect(onPick).toHaveBeenCalledWith({ text: "service:", cardinality: 7 });
  });
});
