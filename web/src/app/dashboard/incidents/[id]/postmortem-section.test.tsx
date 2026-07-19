import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Incident, Postmortem, TimelineEntry } from "@/models";
import { PostmortemSection } from "./postmortem-section";

const incident = (status: Incident["status"]): Incident => ({
  id: "inc_1",
  org_id: "org_1",
  key: "INC-7",
  title: "Edge cache poisoning",
  sev: 2,
  status,
  roles: { commander: "Ibukun", responders: ["Kemi"] },
  started_at: "2026-07-20T09:00:00.000Z",
  resolved_at: status === "resolved" ? "2026-07-20T10:00:00.000Z" : null,
  postmortem_key: null,
  services: ["web"],
});

const entries: TimelineEntry[] = [
  {
    id: "tl_b",
    incident_id: "inc_1",
    ts: "2026-07-20T10:00:00.000Z",
    author: "Ibukun",
    phase: "resolved",
    body: "Purged and locked the cache key.",
  },
  {
    id: "tl_a",
    incident_id: "inc_1",
    ts: "2026-07-20T09:00:00.000Z",
    author: "Ibukun",
    phase: "investigating",
    body: "Declared SEV-2.",
  },
];

const doc: Postmortem = {
  incident_id: "inc_1",
  title: "INC-7 — Edge cache poisoning",
  author: "Ibukun",
  created_at: "2026-07-20T11:00:00.000Z",
  updated_at: "2026-07-20T11:00:00.000Z",
  impact: "Stale pages for 40m.",
  root_cause: "Vary header dropped at the edge.",
  action_items: ["Pin Vary at the edge config"],
  timeline: [...entries]
    .reverse()
    .map(({ ts, phase, author, body }) => ({ ts, phase, author, body })),
};

describe("PostmortemSection (pages.md B9 postmortem template)", () => {
  it("renders nothing before the incident resolves", () => {
    const { container } = render(
      <PostmortemSection
        incident={incident("monitoring")}
        postmortem={null}
        entries={entries}
        onSave={vi.fn()}
        saving={false}
        error={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("offers Start postmortem on resolve and auto-fills the timeline preview", () => {
    render(
      <PostmortemSection
        incident={incident("resolved")}
        postmortem={null}
        entries={entries}
        onSave={vi.fn()}
        saving={false}
        error={null}
      />,
    );
    fireEvent.click(screen.getByTestId("start-postmortem"));
    // oldest-first reading order in the auto-filled preview
    const rows = screen
      .getAllByRole("listitem")
      .map((li) => li.textContent ?? "");
    expect(rows[0]).toContain("Declared SEV-2.");
    expect(rows[1]).toContain("Purged and locked the cache key.");
  });

  it("submits the composed sections with one action item per line", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <PostmortemSection
        incident={incident("resolved")}
        postmortem={null}
        entries={entries}
        onSave={onSave}
        saving={false}
        error={null}
      />,
    );
    fireEvent.click(screen.getByTestId("start-postmortem"));
    fireEvent.change(screen.getByLabelText("Impact"), {
      target: { value: "Stale pages for 40m." },
    });
    fireEvent.change(screen.getByLabelText("Root cause"), {
      target: { value: "Vary header dropped." },
    });
    fireEvent.change(screen.getByLabelText("Action items (one per line)"), {
      target: { value: "Pin Vary\n\nAdd edge test\n" },
    });
    fireEvent.click(screen.getByTestId("save-postmortem"));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave).toHaveBeenCalledWith({
      author: "Ibukun",
      impact: "Stale pages for 40m.",
      root_cause: "Vary header dropped.",
      action_items: ["Pin Vary", "Add edge test"],
    });
  });

  it("renders a composed postmortem with sections, actions and frozen timeline", () => {
    render(
      <PostmortemSection
        incident={{ ...incident("resolved"), postmortem_key: "k" }}
        postmortem={doc}
        entries={entries}
        onSave={vi.fn()}
        saving={false}
        error={null}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Postmortem" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Stale pages for 40m.")).toBeInTheDocument();
    expect(
      screen.getByText("Vary header dropped at the edge."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pin Vary at the edge config"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Edit postmortem" }),
    ).toBeInTheDocument();
  });
});
