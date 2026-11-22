import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ApiError } from "@/models";
import { RequestError } from "./RequestError";

describe("RequestError", () => {
  it("shows the error state with a working retry on a generic failure", () => {
    const onRetry = vi.fn();
    render(
      <RequestError
        error={new Error("boom")}
        onRetry={onRetry}
        what="monitor rules"
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load monitor rules.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("treats a 500 as a failure, not as no access", () => {
    const error = new ApiError(500, {
      code: "internal",
      message: "server error",
    });
    render(<RequestError error={error} onRetry={() => {}} what="uptime" />);
    expect(screen.getByTestId("request-error")).toBeInTheDocument();
    expect(screen.queryByTestId("request-no-access")).not.toBeInTheDocument();
  });

  it("shows the no-access state on a 403, with no retry button", () => {
    const error = new ApiError(403, {
      code: "forbidden",
      message: "forbidden",
    });
    render(
      <RequestError error={error} onRetry={() => {}} what="synthetic checks" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "You don't have access to synthetic checks.",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });
});
