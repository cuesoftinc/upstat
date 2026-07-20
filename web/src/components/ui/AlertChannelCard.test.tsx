import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlertChannelCard, maskChannelTarget } from "./AlertChannelCard";

describe("AlertChannelCard", () => {
  it("offers Verify only while unverified (UNVERIFIED pill)", () => {
    const { rerender } = render(
      <AlertChannelCard
        channel={{
          id: "ch",
          kind: "webhook",
          name: "Ops pager webhook",
          target: "https://x",
          health: "unverified",
          created_at: "",
        }}
        onVerify={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Verify" })).toBeInTheDocument();
    expect(screen.getByText("UNVERIFIED")).toBeInTheDocument();
    rerender(
      <AlertChannelCard
        channel={{
          id: "ch",
          kind: "webhook",
          name: "Ops pager webhook",
          target: "https://x",
          health: "verified",
          created_at: "",
        }}
        onVerify={() => undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: "Verify" })).toBeNull();
    // entity status renders as a labeled pill, not lowercase text
    expect(screen.getByText("VERIFIED")).toBeInTheDocument();
    expect(screen.queryByText("verified")).toBeNull();
  });

  it("renders the degraded state with the failure caption (master anatomy)", () => {
    render(
      <AlertChannelCard
        channel={{
          id: "ch2",
          kind: "email",
          name: "On-call email",
          target: "oncall@upstat.dev",
          health: "degraded",
          failure_note: "Last delivery failed 12m ago — 3 retries exhausted",
          created_at: "",
        }}
      />,
    );
    expect(screen.getByText("On-call email")).toBeInTheDocument();
    expect(screen.getByText("oncall@upstat.dev")).toBeInTheDocument();
    expect(screen.getByText("DEGRADED")).toBeInTheDocument();
    expect(
      screen.getByText("Last delivery failed 12m ago — 3 retries exhausted"),
    ).toBeInTheDocument();
  });

  it("falls back to the kind label when unnamed", () => {
    render(
      <AlertChannelCard
        channel={{
          id: "ch3",
          kind: "email",
          target: "ops@upstat.dev",
          health: "verified",
          created_at: "",
        }}
      />,
    );
    expect(screen.getByText("Email")).toBeInTheDocument();
  });

  it("masks webhook targets after the first path segment", () => {
    expect(
      maskChannelTarget(
        "https://hooks.slack.com/services/T0UPSTAT/B0ALERTS/xxxx",
      ),
    ).toBe("https://hooks.slack.com/services/T0UP…/B0AL…/xxxx");
    expect(maskChannelTarget("oncall@upstat.dev")).toBe("oncall@upstat.dev");
    expect(maskChannelTarget("https://ops.cuesoft.io/hooks/upstat")).toBe(
      "https://ops.cuesoft.io/hooks/upst…",
    );
  });
});
