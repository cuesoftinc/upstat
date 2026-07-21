"use client";

/**
 * / — public home (pages.md Part A, Figma landing v2 frame 135:2).
 * Composition root: nav → A2 hero → A3 pillars → A5 OTel → A12 how-it-works
 * → A4 demo band → A11 use-cases → A6 status embed → A14 self-host →
 * A9 cloud-vs-self-host → A13 developers → A8 community → A15 FAQ →
 * A16 final CTA → A10 footer. Views render-only — all data + handlers come
 * from the home controller.
 */

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { MarketingNav } from "@/components/ui/MarketingNav";
import { useHomeController } from "@/controllers/home";
import { createHydrationGate, gated, Defer } from "./Defer";
import { HeroSection } from "./sections-top";

/*
 * Below-fold bands hydrate on-visible (Defer/gated — the full contract
 * lives in Defer.tsx; perf audit 2026-07-21: eager whole-landing hydration
 * burnt ~1.8s of mobile main-thread time in one chunk, TBT 772ms live).
 * The demo/bottom section modules are their own chunks via next/dynamic
 * (ssr:true keeps the marketing markup in the HTML for SEO —
 * seo.spec/home.spec assert it); no `loading` option on purpose: Defer
 * owns the Suspense boundary, so React leaves each band's server DOM
 * dehydrated-but-visible until its gate releases. Pillars/OTel/
 * how-it-works share the hero's module (their code is already loaded) —
 * the gate alone defers their hydration work. One gate per chunk: the
 * first visible band of a chunk hydrates its siblings with it.
 */
const topGate = createHydrationGate();
const demoGate = createHydrationGate();
const bottomGate = createHydrationGate();

const loadTopSections = () => import("./sections-top");
const loadDemoSections = () => import("./sections-demo");
const loadBottomSections = () => import("./sections-bottom");

const PillarsSection = dynamic(
  gated(topGate, () => loadTopSections().then((m) => m.PillarsSection)),
);
const OtelSection = dynamic(
  gated(topGate, () => loadTopSections().then((m) => m.OtelSection)),
);
const HowItWorksBand = dynamic(
  gated(topGate, () => loadTopSections().then((m) => m.HowItWorksBand)),
);
const DemoBand = dynamic(
  gated(demoGate, () => loadDemoSections().then((m) => m.DemoBand)),
);
const UseCasesBand = dynamic(
  gated(demoGate, () => loadDemoSections().then((m) => m.UseCasesBand)),
);
const StatusEmbedBand = dynamic(
  gated(demoGate, () => loadDemoSections().then((m) => m.StatusEmbedBand)),
);
const SelfHostSection = dynamic(
  gated(bottomGate, () => loadBottomSections().then((m) => m.SelfHostSection)),
);
const CloudSelfHostSection = dynamic(
  gated(bottomGate, () =>
    loadBottomSections().then((m) => m.CloudSelfHostSection),
  ),
);
const DevelopersSection = dynamic(
  gated(bottomGate, () =>
    loadBottomSections().then((m) => m.DevelopersSection),
  ),
);
const CommunitySection = dynamic(
  gated(bottomGate, () => loadBottomSections().then((m) => m.CommunitySection)),
);
const FaqSection = dynamic(
  gated(bottomGate, () => loadBottomSections().then((m) => m.FaqSection)),
);
const FinalCtaSection = dynamic(
  gated(bottomGate, () => loadBottomSections().then((m) => m.FinalCtaSection)),
);
const MarketingFooter = dynamic(
  gated(bottomGate, () =>
    import("@/components/ui/MarketingFooter").then((m) => m.MarketingFooter),
  ),
);

export function HomeView() {
  const {
    stars,
    demo,
    heroCursor,
    onSignIn,
    onTryCloud,
    onSelfHost,
    onSelfHostDocs,
    onGithub,
  } = useHomeController();

  /*
   * Identity-stable below-fold tree (Defer contract, point 2): the hero
   * crosshair rAF loop and the post-mount demo rebuild re-render HomeView
   * several times a second — an update reaching a still-dehydrated band
   * boundary would force React to drop its server DOM. Every dep here is
   * a stable useCallback from the controller, so parent re-renders bail
   * out right above the boundaries. Data-fed bands (*Band) feed themselves
   * (epoch→live inside the band) instead of closing over `demo`.
   */
  const belowFold = useMemo(
    () => (
      <>
        <Defer gate={topGate}>
          <PillarsSection />
        </Defer>
        <Defer gate={topGate}>
          <OtelSection />
        </Defer>
        <Defer gate={topGate}>
          <HowItWorksBand />
        </Defer>
        <Defer gate={demoGate}>
          <DemoBand />
        </Defer>
        <Defer gate={demoGate}>
          <UseCasesBand />
        </Defer>
        <Defer gate={demoGate}>
          <StatusEmbedBand />
        </Defer>
        <Defer gate={bottomGate}>
          <SelfHostSection onSelfHostDocs={onSelfHostDocs} />
        </Defer>
        <Defer gate={bottomGate}>
          <CloudSelfHostSection
            onTryCloud={onTryCloud}
            onSelfHost={onSelfHost}
          />
        </Defer>
        <Defer gate={bottomGate}>
          <DevelopersSection onGithub={onGithub} />
        </Defer>
        <Defer gate={bottomGate}>
          <CommunitySection />
        </Defer>
        <Defer gate={bottomGate}>
          <FaqSection />
        </Defer>
        <Defer gate={bottomGate}>
          <FinalCtaSection onTryCloud={onTryCloud} onSelfHost={onSelfHost} />
        </Defer>
      </>
    ),
    [onTryCloud, onSelfHost, onSelfHostDocs, onGithub],
  );

  /* A10 footer — the canonical parity shape (brand block + 4 columns +
     legal bar) is the component default (SKILL.md canon 2026-07-19) */
  const footer = useMemo(
    () => (
      <Defer gate={bottomGate}>
        <MarketingFooter />
      </Defer>
    ),
    [],
  );

  return (
    <div className="font-ui min-h-screen bg-bg text-text">
      <MarketingNav
        starCount={stars}
        onSignIn={onSignIn}
        onTryCloud={onTryCloud}
      />

      <main>
        {/* the hero (and nav above) hydrate eagerly — everything the
            mobile fold shows; every band below defers to on-visible */}
        <HeroSection
          series={demo.latencySeries}
          query={demo.latencyQuery}
          heartbeat={demo.heartbeat}
          cursor={heroCursor}
          onTryCloud={onTryCloud}
          onSelfHost={onSelfHost}
        />
        {belowFold}
      </main>

      {footer}
    </div>
  );
}
