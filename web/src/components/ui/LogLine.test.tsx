import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LogEvent } from "@/models";
import { LogLine } from "./LogLine";

const LOG: LogEvent = {
  id: "log_1",
  ts: "2026-07-18T09:12:44.120Z",
  service: "checkout",
  level: "ERROR",
  host: "gcp-lagos-1",
  message: "insert failed table=metrics_points",
  attrs: { env: "prod" },
  trace_id: "9f86d081884c7d659a2feaa0c55ad015",
};

describe("LogLine", () => {
  it("expands into the JSON tree (MI-5)", async () => {
    render(<LogLine event={LOG} />);
    expect(screen.queryByText("attrs.env")).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: /insert failed/ }),
    );
    expect(screen.getByText("attrs.env")).toBeInTheDocument();
    expect(screen.getByText("trace_id")).toBeInTheDocument();
  });

  it("⌘click pivots to a query pill (MI-5 signature)", async () => {
    const onPivot = vi.fn();
    const user = userEvent.setup();
    render(<LogLine event={LOG} onPivot={onPivot} />);
    await user.keyboard("{Meta>}");
    await user.click(screen.getByRole("button", { name: /insert failed/ }));
    await user.keyboard("{/Meta}");
    expect(onPivot).toHaveBeenCalledWith("service", "checkout");
  });

  it("supports controlled expansion (B4 virtualized list owns the set)", async () => {
    const onExpandedChange = vi.fn();
    const { rerender } = render(
      <LogLine
        event={LOG}
        expanded={false}
        onExpandedChange={onExpandedChange}
      />,
    );
    // controlled: clicking reports the intent, it does not self-expand
    await userEvent.click(
      screen.getByRole("button", { name: /insert failed/ }),
    );
    expect(onExpandedChange).toHaveBeenCalledWith(true);
    expect(screen.queryByText("attrs.env")).toBeNull();

    rerender(
      <LogLine event={LOG} expanded onExpandedChange={onExpandedChange} />,
    );
    expect(screen.getByText("attrs.env")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /insert failed/ }),
    );
    expect(onExpandedChange).toHaveBeenLastCalledWith(false);
  });
});
