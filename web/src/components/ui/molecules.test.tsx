import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LogEvent } from "@/models";
import { APIKeyRow } from "./APIKeyRow";
import { DashboardListRow } from "./DashboardListRow";
import { FacetGroup } from "./FacetGroup";
import { IncidentBanner } from "./IncidentBanner";
import { LogLine } from "./LogLine";
import { MemberRow } from "./MemberRow";
import { Modal } from "./Modal";
import { MonitorRow } from "./MonitorRow";
import { QueryBar } from "./QueryBar";
import { SLOCard } from "./SLOCard";
import { SavedViewChip } from "./SavedViewChip";
import { Select } from "./Select";
import { SettingsRow } from "./SettingsRow";
import { Switch } from "./Switch";
import { TimePicker } from "./TimePicker";
import { UptimeCard } from "./UptimeCard";
import { ZoomStackChip } from "./ZoomStackChip";

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

describe("TimePicker", () => {
  it("selects presets and toggles live", async () => {
    const onChange = vi.fn();
    const onLive = vi.fn();
    render(<TimePicker value="1h" onChange={onChange} live={false} onLiveChange={onLive} />);
    await userEvent.click(screen.getByRole("button", { name: "4h" }));
    expect(onChange).toHaveBeenCalledWith("4h");
    await userEvent.click(screen.getByRole("button", { name: /live/ }));
    expect(onLive).toHaveBeenCalledWith(true);
  });
});

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
    expect(screen.getByLabelText("Query")).toHaveAttribute("aria-invalid", "true");
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
    await userEvent.click(screen.getByRole("button", { name: /service: 7/ }));
    expect(onPick).toHaveBeenCalledWith({ text: "service:", cardinality: 7 });
  });
});

describe("FacetGroup", () => {
  it("toggles facets and collapses", async () => {
    const onToggle = vi.fn();
    render(
      <FacetGroup
        name="service"
        values={[{ value: "web", count: 12 }]}
        selected={[]}
        onToggle={onToggle}
      />,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "service: web" }));
    expect(onToggle).toHaveBeenCalledWith("web");
    await userEvent.click(screen.getByRole("button", { name: /service/i }));
    expect(screen.queryByText("web")).toBeNull();
  });
});

describe("MonitorRow", () => {
  it("carries status and mute toggle", async () => {
    const onMuted = vi.fn();
    render(
      <MonitorRow
        status="ok"
        name="Homepage"
        summary="https://upstat.cuesoft.io"
        muted={false}
        onMutedChange={onMuted}
      />,
    );
    await userEvent.click(screen.getByRole("switch", { name: "Mute Homepage" }));
    expect(onMuted).toHaveBeenCalledWith(true);
  });
});

describe("LogLine", () => {
  it("expands into the JSON tree (MI-5)", async () => {
    render(<LogLine event={LOG} />);
    expect(screen.queryByText("attrs.env")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /insert failed/ }));
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
});

describe("SLOCard", () => {
  it("renders the burning state with flame + meter", () => {
    render(
      <SLOCard
        slo={{
          id: "slo_1",
          org_id: "org",
          name: "Checkout p95",
          sli_source: "latency",
          target: 99,
          window: "30d",
          current: 98.91,
          budget_remaining_pct: 11,
          burn_rate: 6.2,
          state: "burning",
        }}
      />,
    );
    expect(screen.getByLabelText("burn rate above threshold")).toBeInTheDocument();
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "11");
  });
});

describe("IncidentBanner", () => {
  it("renders resolved as transient calm state", () => {
    render(
      <IncidentBanner sev={1} title="Checkout 5xx" age="3h" responders={["Kemi"]} resolved />,
    );
    expect(screen.getByText("RESOLVED")).toBeInTheDocument();
    expect(screen.queryByText("SEV-1")).toBeNull();
  });
});

describe("UptimeCard", () => {
  it("renders one bar per day with the uptime %", () => {
    const days = Array.from({ length: 90 }, (_, i) => ({
      date: `2026-04-${(i % 30) + 1}`,
      uptime_pct: 100,
      down_minutes: 0,
    }));
    render(<UptimeCard name="Homepage" days={days} uptimePct={99.987} />);
    expect(screen.getByRole("img", { name: "Homepage 90-day uptime" }).children).toHaveLength(90);
    expect(screen.getByText("99.987%")).toBeInTheDocument();
  });
});

describe("SettingsRow", () => {
  it("hosts a control slot", () => {
    render(
      <SettingsRow
        label="Timezone"
        description="IANA — display only"
        control={<Switch checked aria-label="control" />}
      />,
    );
    expect(screen.getByText("Timezone")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "control" })).toBeInTheDocument();
  });
});

describe("Select", () => {
  const OPTIONS = [
    { value: "utc", label: "UTC" },
    { value: "lagos", label: "Africa/Lagos" },
    { value: "berlin", label: "Europe/Berlin" },
  ];

  it("opens and commits a value", async () => {
    const onChange = vi.fn();
    render(<Select options={OPTIONS} value="utc" onValueChange={onChange} aria-label="tz" />);
    await userEvent.click(screen.getByRole("button", { name: "tz" }));
    await userEvent.click(screen.getByRole("button", { name: "Africa/Lagos" }));
    expect(onChange).toHaveBeenCalledWith("lagos");
  });

  it("filters via type-ahead (IANA lists, X-10)", async () => {
    render(
      <Select options={OPTIONS} value={null} onValueChange={() => undefined} typeahead aria-label="tz" />,
    );
    await userEvent.click(screen.getByRole("button", { name: "tz" }));
    await userEvent.type(screen.getByLabelText("Filter options"), "lag");
    const listbox = screen.getByRole("listbox");
    expect(within(listbox).getByText("Africa/Lagos")).toBeInTheDocument();
    expect(within(listbox).queryByText("UTC")).toBeNull();
  });
});

describe("Modal", () => {
  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Declare incident">
        body
      </Modal>,
    );
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("renders the sheet variant", () => {
    render(
      <Modal open onClose={() => undefined} title="Span" variant="sheet">
        body
      </Modal>,
    );
    expect(screen.getByRole("dialog", { name: "Span" })).toBeInTheDocument();
  });
});

describe("SavedViewChip", () => {
  it("shows the shared avatar stack (MI-18)", () => {
    render(<SavedViewChip name="prod errors" sharedWith={["Kemi", "Tola"]} active />);
    expect(screen.getByRole("button", { name: /prod errors/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});

describe("ZoomStackChip", () => {
  it("resets the zoom stack (MI-3)", async () => {
    const onReset = vi.fn();
    render(<ZoomStackChip depth={2} label="09:12–09:40" onReset={onReset} />);
    await userEvent.click(screen.getByLabelText("Reset zoom"));
    expect(onReset).toHaveBeenCalledOnce();
  });
});

describe("MemberRow", () => {
  it("renders roster info with a role select", () => {
    render(
      <MemberRow
        member={{
          id: "usr_kemi",
          name: "Kemi",
          email: "kemi@cuesoft.io",
          role: "admin",
          status: "active",
        }}
      />,
    );
    expect(screen.getByText("kemi@cuesoft.io")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Role for Kemi" })).toBeInTheDocument();
  });
});

describe("APIKeyRow", () => {
  it("hides revoke on revoked keys", () => {
    render(
      <APIKeyRow
        apiKey={{
          id: "key_1",
          kind: "ingestion_token",
          name: "Old collector",
          scope: "otlp",
          key_masked: "uk_live_77d0…12aa",
          status: "revoked",
          created_at: "2026-01-01T00:00:00Z",
          rejected_count: 3,
        }}
        onRevoke={() => undefined}
      />,
    );
    expect(screen.getByText("revoked")).toBeInTheDocument();
    expect(screen.queryByLabelText("Revoke Old collector")).toBeNull();
  });
});

describe("DashboardListRow", () => {
  it("toggles the favorite star", async () => {
    const onFav = vi.fn();
    render(
      <DashboardListRow name="Service overview" updated="2d ago" favorite={false} onFavoriteChange={onFav} shared />,
    );
    await userEvent.click(screen.getByRole("switch", { name: "Favorite Service overview" }));
    expect(onFav).toHaveBeenCalledWith(true);
  });
});
