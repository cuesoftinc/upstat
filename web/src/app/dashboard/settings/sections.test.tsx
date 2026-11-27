import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/models";

const h = vi.hoisted(() => ({
  reloadOrg: vi.fn(),
  reloadKeys: vi.fn(),
  reloadMembers: vi.fn(),
  reloadChannels: vi.fn(),
  org: { current: {} as Record<string, unknown> },
  settings: { current: {} as Record<string, unknown> },
  alerts: { current: {} as Record<string, unknown> },
}));
vi.mock("@/controllers/onboarding", async () => {
  const actual = await vi.importActual<
    typeof import("@/controllers/onboarding")
  >("@/controllers/onboarding");
  return { ...actual, useOrgController: () => h.org.current };
});
vi.mock("@/controllers/settings", async () => {
  const actual = await vi.importActual<typeof import("@/controllers/settings")>(
    "@/controllers/settings",
  );
  return { ...actual, useSettingsController: () => h.settings.current };
});
vi.mock("@/controllers/alerts", async () => {
  const actual = await vi.importActual<typeof import("@/controllers/alerts")>(
    "@/controllers/alerts",
  );
  return { ...actual, useAlertsController: () => h.alerts.current };
});

import {
  IntegrationsSection,
  KeysSection,
  MembersSection,
  OrgSection,
} from "./sections";

const ok = (data: unknown, reload: () => void) => ({
  data,
  loading: false,
  error: null,
  reload,
});
const failed = (error: Error, reload: () => void) => ({
  data: null,
  loading: false,
  error,
  reload,
});

type Failing = "org" | "keys" | "members" | "channels";

function setup(which: Failing, error: Error) {
  h.org.current = {
    ...(which === "org"
      ? failed(error, h.reloadOrg)
      : ok({ name: "Acme", timezone: "UTC" }, h.reloadOrg)),
    update: vi.fn(),
  };
  h.settings.current = {
    keys: which === "keys" ? failed(error, h.reloadKeys) : ok([], h.reloadKeys),
    members:
      which === "members"
        ? failed(error, h.reloadMembers)
        : ok([], h.reloadMembers),
    createKey: vi.fn(),
    rotateKey: vi.fn(),
    revokeKey: vi.fn(),
    inviteMember: vi.fn(),
    setMemberRole: vi.fn(),
  };
  h.alerts.current = {
    channels:
      which === "channels"
        ? failed(error, h.reloadChannels)
        : ok([], h.reloadChannels),
    verifyChannel: vi.fn(),
    removeChannel: vi.fn(),
  };
}

describe("Settings sections load failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("organization: shows the error state with a working retry", () => {
    setup("org", new Error("boom"));
    render(<OrgSection />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load organization settings.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.reloadOrg).toHaveBeenCalledTimes(1);
  });

  it("organization: shows the no-access state on a 403", () => {
    setup("org", new ApiError(403, { code: "forbidden", message: "no" }));
    render(<OrgSection />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "You don't have access to organization settings.",
    );
    expect(
      screen.queryByRole("button", { name: "Try again" }),
    ).not.toBeInTheDocument();
  });

  it("keys: shows the error state, not the empty message", () => {
    setup("keys", new Error("boom"));
    render(<KeysSection />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load API keys.",
    );
    expect(screen.queryByText("No ingestion tokens yet.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.reloadKeys).toHaveBeenCalledTimes(1);
  });

  it("members: shows the error state with a working retry", () => {
    setup("members", new Error("boom"));
    render(<MembersSection />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load members.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.reloadMembers).toHaveBeenCalledTimes(1);
  });

  it("integrations: shows the error state with a working retry", () => {
    setup("channels", new Error("boom"));
    render(<IntegrationsSection />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load integrations.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(h.reloadChannels).toHaveBeenCalledTimes(1);
  });
});
