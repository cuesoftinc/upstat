import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/design/ThemeProvider";
import { HomeView } from "./HomeView";
import { FAQ_ITEMS } from "./content";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const renderHome = () =>
  render(
    <ThemeProvider>
      <HomeView />
    </ThemeProvider>,
  );

describe("HomeView (pages.md Part A — Figma frame 135:2)", () => {
  it("renders every section of the landing", () => {
    renderHome();
    // A2 hero
    expect(
      screen.getByRole("heading", { level: 1, name: /All your telemetry\./ }),
    ).toBeInTheDocument();
    // A3 pillars ×8
    expect(screen.getByText("Eight pillars. One query grammar.")).toBeInTheDocument();
    expect(document.querySelectorAll("#pillars [data-pillar]")).toHaveLength(8);
    // A5 OTel + ingest flow
    expect(screen.getByText("Point your OpenTelemetry SDK at us. Done.")).toBeInTheDocument();
    expect(screen.getByText("upstat ingest + storage")).toBeInTheDocument();
    // A12 how it works — 3 steps
    expect(screen.getByText("How it works")).toBeInTheDocument();
    expect(screen.getByText("Point your SDK at us")).toBeInTheDocument();
    expect(screen.getByText("Send your first data")).toBeInTheDocument();
    expect(screen.getByText("See everything")).toBeInTheDocument();
    // A4 demo band
    expect(screen.getByText("It looks like this — with your data.")).toBeInTheDocument();
    // A11 use-case quads ×4
    expect(screen.getByText("Dashboards that stay in sync")).toBeInTheDocument();
    expect(screen.getByText("From alert to postmortem")).toBeInTheDocument();
    expect(screen.getByText("Status pages people believe")).toBeInTheDocument();
    expect(screen.getByText("Analytics without the banner")).toBeInTheDocument();
    // A6 status embed
    expect(screen.getByText("We run on it. Publicly.")).toBeInTheDocument();
    expect(
      screen.getByText(/\/status\/upstat — our own public status page/),
    ).toBeInTheDocument();
    // A14 self-host + A9 table
    expect(screen.getByText("Self-host — own your telemetry.")).toBeInTheDocument();
    expect(screen.getByText("Cloud when you want it. Yours when you need it.")).toBeInTheDocument();
    // ×2: the table's sm+ CTA footer and the <sm grouped CTA block (the
    // pair is exclusive via CSS breakpoints, which jsdom doesn't apply)
    expect(screen.getAllByRole("button", { name: "Deploy with compose" })).toHaveLength(2);
    // A13 developers — the ratified stack line, verbatim
    expect(
      screen.getByText("Go gRPC services · Next.js + React/TS · ClickHouse · OpenTelemetry"),
    ).toBeInTheDocument();
    // A8 community
    // CTA-dedupe canon: A13 keeps the one GitHub+Discord pair; A8 points at
    // the lab + docs instead
    expect(screen.getByText("Discord — #upstat-lab on the CueLABS™ server")).toBeInTheDocument();
    expect(screen.getByText("CueLABS™ — more open source from Cuesoft")).toBeInTheDocument();
    // A15 FAQ + A16 CTA band
    expect(screen.getByText("Questions, answered.")).toBeInTheDocument();
    expect(screen.getByText("OTLP in. Answers out.")).toBeInTheDocument();
    // A10 footer — the canonical legal bar (parity canon 2026-07-19)
    expect(screen.getByText(/CueLABS™ Division/).closest("p")).toHaveTextContent(
      "© Cuesoft Inc. 2026. Upstat. CueLABS™ Division. MIT License.",
    );
  });

  it("keeps the nav star badge neutral in TEST_MODE (no invented count)", () => {
    renderHome();
    const navigation = screen.getByRole("navigation", { name: "Marketing" });
    expect(
      within(navigation).getByRole("link", { name: "Star cuesoftinc/upstat on GitHub" }),
    ).toHaveTextContent(/^Star$/);
    expect(within(navigation).getByTestId("theme-toggle")).toBeInTheDocument();
  });

  it("FAQ is single-open: opening one closes the other (A15)", async () => {
    renderHome();
    // first item open by default
    expect(screen.getByText(FAQ_ITEMS[0].answer)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: FAQ_ITEMS[1].question }));
    expect(screen.getByText(FAQ_ITEMS[1].answer)).toBeInTheDocument();
    expect(screen.queryByText(FAQ_ITEMS[0].answer)).toBeNull();
  });

  it("Try Cloud CTAs route to /signin", async () => {
    push.mockClear();
    renderHome();
    const ctas = screen.getAllByRole("button", { name: "Try Cloud" });
    expect(ctas.length).toBeGreaterThanOrEqual(3); // hero + table + mobile group + band
    await userEvent.click(ctas[0]);
    expect(push).toHaveBeenCalledWith("/signin");
  });

  it("accuracy: MIT copy present, no fabricated pricing", () => {
    renderHome();
    expect(screen.getByText(/Open-source observability by CueLABS™\. MIT licensed\./)).toBeInTheDocument();
    expect(
      screen.getByText("Self-hosting is free forever — cloud pricing will be announced at GA."),
    ).toBeInTheDocument();
  });

  it("renders the use-case quads with their Read more anchors (§8.4 SCROLL_TO)", () => {
    renderHome();
    const links = screen.getAllByRole("link", { name: "Read more →" });
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "#demo",
      "#status",
      "#status",
      "#faq",
    ]);
  });

  it("demo band renders the seeded panels (uptime strip + query values)", () => {
    renderHome();
    const demo = document.getElementById("demo")!;
    expect(within(demo).getByText("availability · api-common")).toBeInTheDocument();
    expect(within(demo).getByText("99.98%")).toBeInTheDocument();
    expect(within(demo).getByText("p95 latency · api-common")).toBeInTheDocument();
  });
});
