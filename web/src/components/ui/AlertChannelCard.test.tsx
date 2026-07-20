import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AlertChannelCard } from "./AlertChannelCard";

describe("AlertChannelCard", () => {
  it("offers Verify only while unverified", () => {
    const { rerender } = render(
      <AlertChannelCard
        channel={{
          id: "ch",
          kind: "webhook",
          target: "https://x",
          health: "unverified",
          created_at: "",
        }}
        onVerify={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Verify" })).toBeInTheDocument();
    rerender(
      <AlertChannelCard
        channel={{
          id: "ch",
          kind: "webhook",
          target: "https://x",
          health: "verified",
          created_at: "",
        }}
        onVerify={() => undefined}
      />,
    );
    expect(screen.queryByRole("button", { name: "Verify" })).toBeNull();
  });

  it("renders the degraded state for email channels", () => {
    render(
      <AlertChannelCard
        channel={{
          id: "ch2",
          kind: "email",
          target: "oncall@upstat.dev",
          health: "degraded",
          created_at: "",
        }}
      />,
    );
    expect(screen.getByText("oncall@upstat.dev")).toBeInTheDocument();
    // full StatusPill construction per the master (VERIFIED / DEGRADED)
    expect(screen.getByText("DEGRADED")).toBeInTheDocument();
  });
});
