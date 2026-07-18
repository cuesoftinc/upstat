import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CodeSnippet } from "./CodeSnippet";

const TABS = [
  { label: "Go", code: "otel.SetTracerProvider(tp)" },
  { label: "Node", code: "sdk.start()" },
];

describe("CodeSnippet", () => {
  it("switches tabs", async () => {
    render(<CodeSnippet tabs={TABS} />);
    expect(screen.getByText("otel.SetTracerProvider(tp)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Node" }));
    expect(screen.getByText("sdk.start()")).toBeInTheDocument();
  });

  it("flips copy → check (idle/copied)", async () => {
    render(<CodeSnippet tabs={TABS} />);
    const button = screen.getByLabelText("Copy snippet");
    await userEvent.click(button);
    expect(button.querySelector(".text-ok")).not.toBeNull();
  });
});
