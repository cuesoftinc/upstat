import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SyntheticCheck } from "@/models";
import { SyntheticCheckBuilder } from "./SyntheticCheckBuilder";
import UptimePage from "./page";

const { create, update, runOnce, createMonitor, push } = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  runOnce: vi.fn(),
  createMonitor: vi.fn(),
  push: vi.fn(),
}));

const browserCheck: SyntheticCheck = {
  id: "syn_browser",
  name: "Existing browser check",
  kind: "browser",
  steps: [],
  browser: {
    url: "https://example.com/",
    viewport: "1440x900",
    screenshot_on_failure: true,
  },
  interval_seconds: 60,
  last_run_id: null,
  last_run_status: null,
  last_run_at: null,
  created_at: "2026-07-20T10:00:00Z",
  updated_at: "2026-07-20T10:00:00Z",
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));
vi.mock("@/controllers/monitors", () => ({
  useMonitorsController: () => ({
    data: [],
    loading: false,
    create: createMonitor,
  }),
  useUptimeCardsController: () => ({ data: [], loading: false }),
}));
vi.mock("@/controllers/synthetics", () => ({
  useSyntheticsController: () => ({
    data: [browserCheck],
    loading: false,
    create,
    update,
    runOnce,
  }),
}));

describe("browser checks unavailable (#387)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockResolvedValue({ id: "syn_new" });
    createMonitor.mockResolvedValue({ id: "mon_new" });
  });

  it("disables the Browser option and the browser stage on new checks", async () => {
    const user = userEvent.setup();
    render(<SyntheticCheckBuilder />);

    const browserTab = screen.getByRole("tab", {
      name: "Browser (not yet available)",
    });
    expect(browserTab).toBeDisabled();
    await user.click(browserTab);
    expect(screen.getByRole("tab", { name: "Multi-step" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const browserSwitch = screen.getByRole("switch", {
      name: "Run in a browser",
    });
    expect(browserSwitch).toBeDisabled();
    expect(browserSwitch).not.toBeChecked();
    expect(
      screen.getByText("Browser checks are not yet available."),
    ).toBeVisible();

    await user.type(
      screen.getByRole("textbox", { name: "Check name" }),
      "API flow",
    );
    await user.type(
      screen.getByTestId("step-url"),
      "https://example.com/health",
    );
    await user.click(screen.getByRole("button", { name: "+ Add step" }));
    await user.click(screen.getByRole("button", { name: "Save check" }));

    expect(create).toHaveBeenCalledWith({
      name: "API flow",
      kind: "multi_step",
      steps: [
        { kind: "http", method: "GET", url: "https://example.com/health" },
      ],
      browser: null,
    });
  });

  it("keeps HTTP check creation available", async () => {
    const user = userEvent.setup();
    render(<SyntheticCheckBuilder />);
    await user.click(screen.getByRole("tab", { name: "HTTP" }));
    await user.type(
      screen.getByRole("textbox", { name: "Check name" }),
      "Health",
    );
    await user.type(
      screen.getByRole("textbox", { name: "URL" }),
      "https://example.com/",
    );
    await user.click(screen.getByRole("button", { name: "Save check" }));

    expect(createMonitor).toHaveBeenCalledWith({
      name: "Health",
      target: "https://example.com/",
      type: "website",
      interval_seconds: 60,
    });
    expect(push).toHaveBeenCalledWith("/dashboard/uptime/mon_new");
  });

  it("keeps existing browser configuration visible while blocking save and run", () => {
    render(<SyntheticCheckBuilder editing={browserCheck} />);
    expect(screen.getByDisplayValue("https://example.com/")).toBeDisabled();
    expect(
      screen.getByText("Browser checks are not yet available."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Run once" })).toBeDisabled();
    expect(update).not.toHaveBeenCalled();
    expect(runOnce).not.toHaveBeenCalled();
  });

  it("continues listing existing browser checks", () => {
    render(<UptimePage />);
    const list = screen.getByRole("list", { name: "Synthetic checks" });
    expect(
      within(list).getByRole("link", { name: /Existing browser check/ }),
    ).toHaveAttribute("href", "/dashboard/uptime/checks/syn_browser");
    expect(within(list).getByText("BROWSER")).toBeVisible();
  });
});
