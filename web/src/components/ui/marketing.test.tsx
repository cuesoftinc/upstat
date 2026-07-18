import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CloudVsSelfHostTable } from "./CloudVsSelfHostTable";
import { CodeSnippet } from "./CodeSnippet";
import { FAQItem } from "./FAQItem";
import { GoogleAuthButton } from "./GoogleAuthButton";
import { MarketingFooter } from "./MarketingFooter";
import { MarketingNav } from "./MarketingNav";
import { MARKETING_PILLARS, PillarCard } from "./PillarCard";

describe("MarketingNav", () => {
  it("keeps the star badge neutral without a runtime count (A13)", () => {
    render(<MarketingNav />);
    const badge = screen.getByRole("link", { name: /Star/ });
    expect(badge).toHaveTextContent(/^Star$/);
  });

  it("shows the runtime star count when provided", () => {
    render(<MarketingNav starCount={1284} />);
    expect(screen.getByText("1,284")).toBeInTheDocument();
  });

  it("opens the pillar dropdown as a mini feature map ×8 (A1)", async () => {
    render(<MarketingNav />);
    await userEvent.click(screen.getByRole("button", { name: "Platform" }));
    const menu = screen.getByRole("menu", { name: "Platform pillars" });
    expect(menu.querySelectorAll("[data-pillar]")).toHaveLength(8);
  });
});

describe("PillarCard", () => {
  it("defines all 8 pillars", () => {
    expect(MARKETING_PILLARS).toHaveLength(8);
    render(<PillarCard {...MARKETING_PILLARS[0]} />);
    expect(screen.getByText("Uptime & Synthetics")).toBeInTheDocument();
  });
});

describe("CodeSnippet", () => {
  const TABS = [
    { label: "Go", code: "otel.SetTracerProvider(tp)" },
    { label: "Node", code: "sdk.start()" },
  ];

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
});

describe("CloudVsSelfHostTable", () => {
  it("renders plan columns with per-column CTAs (A9)", () => {
    render(<CloudVsSelfHostTable />);
    expect(screen.getByText("MIT-licensed source")).toBeInTheDocument();
    expect(screen.getByText("Managed upgrades & backups")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Cloud" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Self Host" })).toBeInTheDocument();
  });
});

describe("FAQItem", () => {
  it("expands and collapses (single-open orchestrated by parent)", async () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <FAQItem question="Is everything open source?" answer="Yes — MIT." expanded={false} onToggle={onToggle} />,
    );
    expect(screen.queryByText("Yes — MIT.")).toBeNull();
    await userEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
    rerender(
      <FAQItem question="Is everything open source?" answer="Yes — MIT." expanded onToggle={onToggle} />,
    );
    expect(screen.getByText("Yes — MIT.")).toBeInTheDocument();
  });
});

describe("MarketingFooter", () => {
  it("links privacy per UPS-005", () => {
    render(<MarketingFooter />);
    expect(screen.getByRole("link", { name: "Privacy (cookieless)" })).toHaveAttribute(
      "href",
      "/privacy",
    );
    expect(screen.getByText(/MIT licensed/)).toBeInTheDocument();
  });
});

describe("GoogleAuthButton (X-1 CTA)", () => {
  it("stays the single-CTA shape", () => {
    render(<GoogleAuthButton />);
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
  });
});
