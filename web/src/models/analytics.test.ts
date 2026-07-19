import { describe, expect, it, vi } from "vitest";
import { analytics, createTracker } from "./analytics";

describe("analytics tracker (api.md §3.4 registry, TEST_MODE-safe)", () => {
  it("is disabled under TEST_MODE (hermetic CI — the vitest env sets it)", () => {
    expect(analytics.enabled).toBe(false);
  });

  it("no-ops when disabled", () => {
    const transport = vi.fn().mockResolvedValue(undefined);
    const tracker = createTracker({ enabled: false, transport });
    tracker.track("page_view", { path: "/" });
    expect(transport).not.toHaveBeenCalled();
  });

  it("sends the §3.1 batch shape when enabled", () => {
    const transport = vi.fn().mockResolvedValue(undefined);
    const tracker = createTracker({ enabled: true, transport });
    tracker.track("try_cloud_click", { path: "/" });
    expect(transport).toHaveBeenCalledWith([
      { name: "try_cloud_click", dims: { path: "/" } },
    ]);
  });

  it("swallows transport failures — analytics never breaks the page", () => {
    const transport = vi.fn().mockRejectedValue(new Error("network down"));
    const tracker = createTracker({ enabled: true, transport });
    expect(() => tracker.track("github_click")).not.toThrow();
  });
});
