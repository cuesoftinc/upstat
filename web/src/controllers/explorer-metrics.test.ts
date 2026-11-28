// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const { run } = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock("@/models/repositories", () => ({
  queryRepo: { run },
  viewsRepo: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    remove: vi.fn(),
  },
  dashboardsRepo: { addWidget: vi.fn() },
}));
vi.mock("@/controllers/time-range", () => ({
  useTimeRange: () => ({
    fromIso: "2026-01-01T00:00:00.000Z",
    toIso: "2026-01-01T01:00:00.000Z",
  }),
}));

import { useMetricsExplorerController } from "./explorer";

const RESULT = { kind: "timeseries", series: [], step: "1m" };

describe("useMetricsExplorerController query failures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes a failed request to requestError, not to the syntax error", async () => {
    run.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useMetricsExplorerController());
    await waitFor(() => expect(result.current.requestError).not.toBeNull());
    expect(result.current.requestError?.message).toBe("boom");
    expect(result.current.syntaxError).toBeNull();
  });

  it("keeps a real invalid_query in the syntax error", async () => {
    run.mockRejectedValue(
      new ApiError(400, { code: "invalid_query", message: "bad query" }),
    );
    const { result } = renderHook(() => useMetricsExplorerController());
    await waitFor(() => expect(result.current.syntaxError).toBe("bad query"));
    expect(result.current.requestError).toBeNull();
  });

  it("rerun retries the active query and clears the error", async () => {
    run.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useMetricsExplorerController());
    await waitFor(() => expect(result.current.requestError).not.toBeNull());

    run.mockResolvedValue(RESULT);
    await act(async () => {
      await result.current.rerun();
    });
    await waitFor(() => expect(result.current.requestError).toBeNull());
    expect(run).toHaveBeenCalledTimes(2);
  });
});
