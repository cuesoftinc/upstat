import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import GlobalError from "./global-error";

describe("GlobalError", () => {
  it("renders the fallback heading, calls reset on Try again, links to /dashboard, and hides error details", () => {
    const reset = vi.fn();
    render(
      <GlobalError error={new Error("internal root crash")} reset={reset} />,
    );

    expect(
      screen.getByRole("heading", { name: "Something went wrong." }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/internal root crash/)).not.toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Go to the dashboard" });
    expect(link).toHaveAttribute("href", "/dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
