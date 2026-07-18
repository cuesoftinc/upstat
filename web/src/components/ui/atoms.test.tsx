import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Avatar, AvatarStack } from "./Avatar";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { CountBadge, BufferedCountChip } from "./CountBadge";
import { Input } from "./Input";
import { KbdChip } from "./KbdChip";
import { LevelChip } from "./LevelChip";
import { QueryPill } from "./QueryPill";
import { SevChip } from "./SevChip";
import { Skeleton } from "./Skeleton";
import { StatusPill } from "./StatusPill";
import { Switch } from "./Switch";
import { Toast } from "./Toast";
import { Tooltip } from "./Tooltip";

describe("Button", () => {
  it("renders the three kinds with data-kind", () => {
    const { rerender } = render(<Button kind="brand">Save</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-kind", "brand");
    rerender(<Button kind="quiet">Save</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-kind", "quiet");
    rerender(<Button kind="destructive">Delete</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("data-kind", "destructive");
  });

  it("blocks clicks when disabled", async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button")).catch(() => undefined);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Input", () => {
  it("marks the error state with aria-invalid", () => {
    render(<Input error aria-label="Name" />);
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Toast", () => {
  it("renders each kind and dismisses", async () => {
    const onDismiss = vi.fn();
    render(<Toast kind="error" message="Something failed" onDismiss={onDismiss} />);
    expect(screen.getByRole("status")).toHaveAttribute("data-kind", "error");
    await userEvent.click(screen.getByLabelText("Dismiss"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

describe("StatusPill", () => {
  it("breathes only while crit (MI-8)", () => {
    const { container, rerender } = render(<StatusPill status="crit" />);
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
    rerender(<StatusPill status="ok" />);
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("keeps an accessible label in dot-only mode", () => {
    render(<StatusPill status="paused" dotOnly />);
    expect(screen.getByText("paused")).toHaveClass("sr-only");
  });
});

describe("QueryPill", () => {
  it("renders facet:value and removes", async () => {
    const onRemove = vi.fn();
    render(<QueryPill facet="service" value="api-common" onRemove={onRemove} />);
    expect(screen.getByText("service:")).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Remove filter service:api-common"));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});

describe("LevelChip", () => {
  it("applies the decided level mapping", () => {
    render(<LevelChip level="INFO" />);
    expect(screen.getByText("INFO")).toHaveClass("text-brand");
  });
});

describe("SevChip", () => {
  it("renders SEV-n", () => {
    render(<SevChip sev={1} />);
    expect(screen.getByText("SEV-1")).toHaveAttribute("data-sev", "1");
  });
});

describe("Switch", () => {
  it("toggles via role=switch", async () => {
    const onChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onChange} aria-label="Mute" />);
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("Checkbox", () => {
  it("exposes the indeterminate state as mixed", () => {
    render(<Checkbox checked="indeterminate" aria-label="Select all" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("aria-checked", "mixed");
  });
});

describe("KbdChip", () => {
  it("renders chords as separate keys", () => {
    render(<KbdChip keys="g d" />);
    expect(screen.getByText("g")).toBeInTheDocument();
    expect(screen.getByText("d")).toBeInTheDocument();
  });
});

describe("CountBadge", () => {
  it("hides at zero and caps at 99+", () => {
    const { container, rerender } = render(<CountBadge count={0} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<CountBadge count={128} />);
    expect(screen.getByText("99+")).toBeInTheDocument();
  });
});

describe("BufferedCountChip", () => {
  it("shows the ▼ n new affordance (MI-4)", async () => {
    const onClick = vi.fn();
    render(<BufferedCountChip count={128} onClick={onClick} />);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
    expect(screen.getByText("128")).toBeInTheDocument();
  });
});

describe("Avatar", () => {
  it("falls back to initials", () => {
    render(<Avatar name="Ibukun Dairo" />);
    expect(screen.getByText("ID")).toBeInTheDocument();
  });
});

describe("AvatarStack", () => {
  it("overflows into +n", () => {
    render(<AvatarStack names={["A", "B", "C", "D"]} max={2} />);
    expect(screen.getByText("+2")).toBeInTheDocument();
  });
});

describe("Skeleton", () => {
  it("renders each kind", () => {
    const { container, rerender } = render(<Skeleton kind="line" />);
    expect(container.querySelector('[data-kind="line"]')).not.toBeNull();
    rerender(<Skeleton kind="panel-axis" />);
    expect(container.querySelector('[data-kind="panel-axis"]')).not.toBeNull();
  });
});

describe("Tooltip", () => {
  it("shows multi-metric rows on hover", async () => {
    render(
      <Tooltip content={[{ label: "error", value: "1.2%" }]}>
        <span>target</span>
      </Tooltip>,
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
    await userEvent.hover(screen.getByText("target"));
    expect(screen.getByRole("tooltip")).toHaveTextContent("error");
    expect(screen.getByRole("tooltip")).toHaveTextContent("1.2%");
  });
});
