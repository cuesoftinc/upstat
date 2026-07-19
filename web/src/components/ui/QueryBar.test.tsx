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
    expect(screen.getByLabelText("Query")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
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
    await userEvent.click(screen.getByRole("button", { name: /service:\s*7/ }));
    expect(onPick).toHaveBeenCalledWith({ text: "service:", cardinality: 7 });
  });

  it("filters suggestions to the typed token and Tab-completes the best match (MI-13)", async () => {
    const onPick = vi.fn();
    render(
      <QueryBar
        pills={[]}
        text="metric:http.err"
        onTextChange={() => undefined}
        suggestions={[
          { text: "service:clickhouse", cardinality: 7133 },
          { text: "metric:http.request.duration_ms", cardinality: 1240 },
          { text: "metric:http.errors_total", cardinality: 412 },
        ]}
        onPickSuggestion={onPick}
      />,
    );
    await userEvent.click(screen.getByLabelText("Query"));
    // non-matching, higher-cardinality entries stay out of the list — an
    // unfiltered list made Tab insert an unrelated pill (QA 2026-07-19)
    expect(screen.queryByText("service:clickhouse")).toBeNull();
    expect(screen.getByText("metric:http.errors_total")).toBeInTheDocument();
    await userEvent.keyboard("{Tab}");
    expect(onPick).toHaveBeenCalledWith({
      text: "metric:http.errors_total",
      cardinality: 412,
    });
  });
});
