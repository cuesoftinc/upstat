import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CodeSnippet } from "./CodeSnippet";

const TABS = [
  { label: "Go", code: "otel.SetTracerProvider(tp)" },
  { label: "Node", code: "sdk.start()" },
];

const SELF_HOST_TABS = [
  {
    label: "Docker Compose",
    code: "git clone https://github.com/cuesoftinc/upstat\ncd upstat && docker compose up --build -d",
  },
  {
    label: "Helm",
    code: "git clone https://github.com/cuesoftinc/upstat\ncd upstat && helm install upstat deploy/helm",
  },
];

function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

describe("CodeSnippet", () => {
  it("switches tabs", async () => {
    render(<CodeSnippet tabs={TABS} />);
    expect(screen.getByText("otel.SetTracerProvider(tp)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Node" }));
    expect(screen.getByText("sdk.start()")).toBeInTheDocument();
  });

  it("flips copy → check (idle/copied)", async () => {
    render(<CodeSnippet tabs={TABS} />);
    const button = screen.getByLabelText("Copy snippet");
    await userEvent.click(button);
    expect(button.querySelector(".text-ok")).not.toBeNull();
  });

  it("labels the tablist — §8.2b language axis by default, overridable", () => {
    const { unmount } = render(<CodeSnippet tabs={TABS} />);
    expect(
      screen.getByRole("tablist", { name: "Language" }),
    ).toBeInTheDocument();
    unmount();
    render(<CodeSnippet tabs={SELF_HOST_TABS} tabsLabel="Install method" />);
    expect(
      screen.getByRole("tablist", { name: "Install method" }),
    ).toBeInTheDocument();
  });

  it("roves focus with arrow keys (tablist semantics)", async () => {
    render(<CodeSnippet tabs={TABS} />);
    const go = screen.getByRole("tab", { name: "Go" });
    const node = screen.getByRole("tab", { name: "Node" });
    expect(go).toHaveAttribute("tabindex", "0");
    expect(node).toHaveAttribute("tabindex", "-1");
    go.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(node).toHaveFocus();
    expect(node).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowLeft}");
    expect(go).toHaveFocus();
    expect(go).toHaveAttribute("aria-selected", "true");
  });

  it("prompt mode (A14): decorative $ prompts, raw commands in the payload", async () => {
    const writeText = mockClipboard();
    render(
      <CodeSnippet tabs={SELF_HOST_TABS} tabsLabel="Install method" prompt />,
    );
    // both lines render with the select-none prompt decor
    expect(screen.getAllByText("$")).toHaveLength(2);
    expect(
      screen.getByText(/cd upstat && docker compose up --build -d/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Copy snippet"));
    expect(writeText).toHaveBeenCalledWith(SELF_HOST_TABS[0].code);
  });

  it("copy targets the ACTIVE tab — helm block after a switch", async () => {
    const writeText = mockClipboard();
    render(
      <CodeSnippet tabs={SELF_HOST_TABS} tabsLabel="Install method" prompt />,
    );
    await userEvent.click(screen.getByRole("tab", { name: "Helm" }));
    expect(
      screen.getByText(/helm install upstat deploy\/helm/),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText("Copy snippet"));
    expect(writeText).toHaveBeenCalledWith(SELF_HOST_TABS[1].code);
  });

  it("copied check resets when the tab switches", async () => {
    mockClipboard();
    render(<CodeSnippet tabs={TABS} />);
    const button = screen.getByLabelText("Copy snippet");
    await userEvent.click(button);
    expect(button.querySelector(".text-ok")).not.toBeNull();
    await userEvent.click(screen.getByRole("tab", { name: "Node" }));
    expect(button.querySelector(".text-ok")).toBeNull();
  });
});
