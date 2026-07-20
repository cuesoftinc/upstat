import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { APIKeyRow } from "./APIKeyRow";

describe("APIKeyRow", () => {
  it("hides revoke on revoked keys (REVOKED pill)", () => {
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
    // entity status renders as a labeled pill, not lowercase text
    expect(screen.getByText("REVOKED")).toBeInTheDocument();
    expect(screen.queryByText("revoked")).toBeNull();
    expect(screen.queryByLabelText("Revoke Old collector")).toBeNull();
    // OTLP ingestion tokens carry per-signal scope chips (master anatomy)
    for (const signal of ["logs", "metrics", "traces"]) {
      expect(screen.getByText(signal)).toBeInTheDocument();
    }
  });

  it("shows the ROTATING pill + grace copy on rotation-grace keys", () => {
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
    expect(screen.getByText("ROTATING")).toBeInTheDocument();
    expect(screen.getByText("grace ends in 24h")).toBeInTheDocument();
    // property keys chip their single RUM signal
    expect(screen.getByText("rum")).toBeInTheDocument();
  });

  it("shows the ACTIVE pill + 24h rejects counter on active keys", () => {
    render(
      <APIKeyRow
        apiKey={{
          id: "key_3",
          kind: "ingestion_token",
          name: "prod ingest — api-common",
          scope: "otlp",
          key_masked: "uk_live_9f2c…3d1a",
          status: "active",
          created_at: "2026-01-01T00:00:00Z",
          rejected_count: 0,
        }}
        onRevoke={() => undefined}
      />,
    );
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("0 rejects (24h)")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Revoke prod ingest — api-common"),
    ).toBeInTheDocument();
  });
});
