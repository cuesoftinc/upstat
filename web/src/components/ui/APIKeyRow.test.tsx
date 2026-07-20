import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { APIKeyRow } from "./APIKeyRow";

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
    expect(screen.getByText("REVOKED")).toBeInTheDocument();
    expect(screen.queryByLabelText("Revoke Old collector")).toBeNull();
  });

  it("shows the rotation-grace state + rejection counter", () => {
    render(
      <APIKeyRow
        apiKey={{
          id: "key_2",
          kind: "property_key",
          name: "upstat.cuesoft.io",
          scope: "rum",
          key_masked: "pk_live_9b41…77e2",
          status: "rotation_grace",
          created_at: "2026-01-01T00:00:00Z",
          rejected_count: 431,
        }}
      />,
    );
    // full StatusPill construction per the master (ACTIVE / ROTATING)
    expect(screen.getByText("ROTATING")).toBeInTheDocument();
    expect(screen.getByText("431 rejected")).toBeInTheDocument();
  });
});
