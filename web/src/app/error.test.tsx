import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ErrorPage from "./error";

class RouteBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorPage
          error={this.state.error}
          reset={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}

describe("ErrorPage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the error heading, calls reset on Try again, links to /dashboard, and hides internal details", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    render(
      <ErrorPage error={new Error("secret internal stack")} reset={reset} />,
    );

    expect(
      screen.getByRole("heading", { name: "Something went wrong." }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/secret internal stack/)).not.toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Go to the dashboard" });
    expect(link).toHaveAttribute("href", "/dashboard");

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalled();
  });

  it("catches a throwing page and recovers when Try again is clicked", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;
    function CrashingPage() {
      if (shouldThrow) throw new Error("boom in page");
      return <div>Recovered page</div>;
    }

    render(
      <RouteBoundary>
        <CrashingPage />
      </RouteBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: "Something went wrong." }),
    ).toBeInTheDocument();

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByText("Recovered page")).toBeInTheDocument();
  });
});
