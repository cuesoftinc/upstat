import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AlertEvent, AlertRule } from "@/models";
import { AlertChannelCard } from "./AlertChannelCard";
import { AlertFeedRow, NotificationPopover } from "./AlertFeedRow";
import { AlertRuleCard } from "./AlertRuleCard";
import { IncidentComposer } from "./IncidentComposer";
import { IncidentHistoryEntry } from "./IncidentHistoryEntry";
import { ServiceCatalogRow } from "./ServiceCatalogRow";
import { ErrorGroupRow } from "./ErrorGroupRow";
import { StatusPageComponentRow } from "./StatusPageComponentRow";
import { StatusPageHeader } from "./StatusPageHeader";
import { WidgetTypePicker, WIDGET_TYPES } from "./WidgetTypePicker";

const RULE: AlertRule = {
  id: "rule_1",
  org_id: "org",
  name: "Checkout p95 latency",
  signal: "metric",
  query: { v: 1, filters: { op: "and", terms: [] }, step: "auto" },
  query_string: "metric:http.request.duration_ms service:checkout | p95()",
  thresholds: { warn: 800, crit: 1500, window: "5m" },
  notify: { channel_ids: [], cooldown_minutes: 10, renotify_minutes: 0, mute_windows: [] },
  state: "alert",
  last_triggered_at: "2026-07-18T09:00:00Z",
};

const EVENT: AlertEvent = {
  id: "evt_1",
  ts: "2026-07-18T09:00:00Z",
  sev: "sev1",
  rule_id: "rule_1",
  monitor_name: "Checkout p95 latency",
  message: "p95 2,412 ms breached crit 1,500 ms",
  unread: true,
};

describe("AlertChannelCard", () => {
  it("offers Verify only while unverified", () => {
    const { rerender } = render(
      <AlertChannelCard
        channel={{ id: "ch", kind: "webhook", target: "https://x", health: "unverified", created_at: "" }}
        onVerify={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Verify" })).toBeInTheDocument();
    rerender(
      <AlertChannelCard
        channel={{ id: "ch", kind: "webhook", target: "https://x", health: "verified", created_at: "" }}
        onVerify={() => undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: "Verify" })).toBeNull();
  });
});

describe("AlertRuleCard", () => {
  it("shows the mono query + thresholds", () => {
    render(<AlertRuleCard rule={RULE} />);
    expect(screen.getByText(RULE.query_string)).toBeInTheDocument();
    expect(screen.getByText("1500")).toBeInTheDocument();
    expect(screen.getByText("metric threshold")).toBeInTheDocument();
  });
});

describe("AlertFeedRow", () => {
  it("carries sev tint + unread state", () => {
    render(<AlertFeedRow event={EVENT} />);
    const row = screen.getByRole("button");
    expect(row).toHaveAttribute("data-sev", "sev1");
    expect(row).toHaveAttribute("data-unread", "true");
  });
});

describe("NotificationPopover", () => {
  it("shows the empty state", () => {
    render(<NotificationPopover events={[]} />);
    expect(screen.getByText("Nothing triggered. Calm seas.")).toBeInTheDocument();
  });
});

describe("IncidentComposer", () => {
  it("autocompletes slash commands (MI-10)", async () => {
    render(<IncidentComposer onSubmit={() => undefined} />);
    await userEvent.type(screen.getByLabelText("Incident update"), "/sta");
    expect(screen.getByRole("listbox", { name: "Slash commands" })).toBeInTheDocument();
    expect(screen.getByText("/status resolved")).toBeInTheDocument();
  });

  it("parses /status into the submitted phase", async () => {
    const onSubmit = vi.fn();
    render(<IncidentComposer onSubmit={onSubmit} />);
    const input = screen.getByLabelText("Incident update");
    await userEvent.type(input, "/status resolved all clear");
    await userEvent.click(screen.getByRole("button", { name: "Post update" }));
    expect(onSubmit).toHaveBeenCalledWith({
      body: "/status resolved all clear",
      phase: "resolved",
    });
  });
});

describe("IncidentHistoryEntry", () => {
  it("renders phased, timestamped updates", () => {
    render(
      <IncidentHistoryEntry
        title="INC-42 — Checkout 5xx spike"
        updates={[
          { ts: "2026-07-18T09:00:00Z", phase: "investigating", body: "Declared." },
          { ts: "2026-07-18T09:45:00Z", phase: "monitoring", body: "Throttle applied." },
        ]}
      />,
    );
    expect(screen.getByText("investigating")).toBeInTheDocument();
    expect(screen.getByText("monitoring")).toBeInTheDocument();
  });
});

describe("StatusPageHeader", () => {
  it("renders each overall state copy", () => {
    const { rerender } = render(
      <StatusPageHeader orgName="Upstat" overall="operational" lastUpdated="2026-07-18T12:00:00Z" />,
    );
    expect(screen.getByText("All systems operational")).toBeInTheDocument();
    rerender(
      <StatusPageHeader orgName="Upstat" overall="major_outage" lastUpdated="2026-07-18T12:00:00Z" />,
    );
    expect(screen.getByText("Major outage")).toBeInTheDocument();
  });
});

describe("StatusPageComponentRow", () => {
  it("renders the 90-day strip", () => {
    const days = Array.from({ length: 90 }, (_, i) => ({
      date: `d${i}`,
      uptime_pct: 100,
      down_minutes: 0,
    }));
    render(<StatusPageComponentRow name="API" status="ok" days={days} uptimePct={99.99} />);
    expect(screen.getByRole("img", { name: "API 90-day uptime" }).children).toHaveLength(90);
  });
});

describe("ServiceCatalogRow", () => {
  it("shows telemetry presence dots ×4", () => {
    const { container } = render(
      <ServiceCatalogRow
        entry={{
          id: "svc",
          name: "checkout",
          owner: "Sade",
          links: { repo: "https://github.com/cuesoftinc/upstat" },
          environments: ["prod"],
          telemetry: { metrics: true, logs: true, traces: true, rum: false },
        }}
      />,
    );
    expect(container.querySelectorAll("[data-pillar]")).toHaveLength(4);
    expect(container.querySelectorAll("[data-present]")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /repo/ })).toBeInTheDocument();
  });
});

describe("ErrorGroupRow", () => {
  it("renders fingerprint message, count and state", () => {
    render(
      <ErrorGroupRow
        group={{
          fingerprint: "fe4a9d21",
          message: "TypeError: Cannot read properties of undefined",
          count: 128,
          first_seen: "2026-07-12T00:00:00Z",
          last_seen: "2026-07-18T11:42:00Z",
          state: "regressed",
          sparkline: [1, 4, 2, 8],
        }}
      />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "regressed");
    expect(screen.getByText("128")).toBeInTheDocument();
  });
});

describe("WidgetTypePicker", () => {
  it("renders the 11 pages.md B2 widget types and selects", async () => {
    const onSelect = vi.fn();
    render(<WidgetTypePicker layout="grid" onSelect={onSelect} />);
    expect(WIDGET_TYPES).toHaveLength(11);
    for (const t of WIDGET_TYPES) {
      expect(screen.getByRole("button", { name: t.label })).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole("button", { name: "Heatmap" }));
    expect(onSelect).toHaveBeenCalledWith("heatmap");
  });
});
