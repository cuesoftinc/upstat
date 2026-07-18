import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ServiceCatalogRow } from "./ServiceCatalogRow";

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
