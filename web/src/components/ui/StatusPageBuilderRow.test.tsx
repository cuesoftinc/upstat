import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StatusPageBuilderRow } from "./StatusPageBuilderRow";

const MONITORS = [
  { value: "mon_api", label: "API health" },
  { value: "mon_homepage", label: "Homepage" },
];

describe("StatusPageBuilderRow", () => {
  it("renders the inline-rename input and the mapped monitor", () => {
    render(
      <StatusPageBuilderRow
        name="API"
        onRename={() => {}}
        monitorId="mon_api"
        monitorOptions={MONITORS}
        onMonitorChange={() => {}}
      />,
    );
    expect(screen.getByLabelText("Component name")).toHaveValue("API");
    expect(screen.getByText("API health")).toBeInTheDocument();
    expect(screen.getByText("monitor:")).toBeInTheDocument();
  });

  it("renames inline", () => {
    const onRename = vi.fn();
    render(
      <StatusPageBuilderRow
        name="API"
        onRename={onRename}
        monitorId={null}
        monitorOptions={MONITORS}
        onMonitorChange={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("Component name"), {
      target: { value: "Public API" },
    });
    expect(onRename).toHaveBeenCalledWith("Public API");
  });

  it("deletes and reorders via grip keys", () => {
    const onDelete = vi.fn();
    const onMove = vi.fn();
    render(
      <StatusPageBuilderRow
        name="Ingestion"
        onRename={() => {}}
        monitorId={null}
        monitorOptions={MONITORS}
        onMonitorChange={() => {}}
        onDelete={onDelete}
        onMove={onMove}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete Ingestion" }));
    expect(onDelete).toHaveBeenCalledOnce();
    fireEvent.keyDown(
      screen.getByRole("button", { name: "Reorder Ingestion" }),
      {
        key: "ArrowDown",
      },
    );
    expect(onMove).toHaveBeenCalledWith(1);
  });
});
