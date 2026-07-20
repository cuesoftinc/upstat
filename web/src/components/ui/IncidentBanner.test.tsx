import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { IncidentBanner } from "./IncidentBanner";

describe("IncidentBanner", () => {
  it("renders sev1 persistent banner with responders", () => {
    render(
      <IncidentBanner
        sev={1}
        title="Checkout 5xx"
        age="3h"
        responders={["Kemi", "Tola"]}
      />,
    );
    expect(screen.getByText("SEV-1")).toBeInTheDocument();
    // master construction (48:141): "open 12m" age + explicit link text
    expect(screen.getByText("open 3h")).toBeInTheDocument();
    expect(screen.getByText("View incident →")).toBeInTheDocument();
  });

  it("renders resolved as transient calm state", () => {
    render(
      <IncidentBanner
        sev={1}
        title="Checkout 5xx"
        age="3h"
        responders={["Kemi"]}
        resolved
      />,
    );
    expect(screen.getByText("RESOLVED")).toBeInTheDocument();
    expect(screen.queryByText("SEV-1")).toBeNull();
  });
});
