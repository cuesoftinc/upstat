"use client";

/**
 * / — public home (pages.md Part A, Figma landing v2 frame 135:2).
 * Composition root: nav → A2 hero → A3 pillars → A5 OTel → A12 how-it-works
 * → A4 demo band → A11 use-cases → A6 status embed → A14 self-host →
 * A9 cloud-vs-self-host → A13 developers → A8 community → A15 FAQ →
 * A16 final CTA → A10 footer. Views render-only — all data + handlers come
 * from the home controller.
 */

import { MarketingFooter } from "@/components/ui/MarketingFooter";
import { MarketingNav } from "@/components/ui/MarketingNav";
import { useHomeController } from "@/controllers/home";
import { FOOTER_COLUMNS, FOOTER_COPYRIGHT } from "./content";
import {
  CloudSelfHostSection,
  CommunitySection,
  DevelopersSection,
  FaqSection,
  FinalCtaSection,
  SelfHostSection,
} from "./sections-bottom";
import {
  DemoBandSection,
  StatusEmbedSection,
  UseCasesSection,
} from "./sections-demo";
import {
  HeroSection,
  HowItWorksSection,
  OtelSection,
  PillarsSection,
} from "./sections-top";

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

  return (
    <div className="font-ui min-h-screen bg-bg text-text">
      <MarketingNav starCount={stars} onSignIn={onSignIn} onTryCloud={onTryCloud} />

      {/* block + min-w-0: the legacy layer styles bare `main` as a
          100vw flex row (globals.css @layer legacy) — utilities win */}
      <main className="block min-w-0">
        <HeroSection
          series={demo.latencySeries}
          query={demo.latencyQuery}
          heartbeat={demo.heartbeat}
          cursor={heroCursor}
          onTryCloud={onTryCloud}
          onSelfHost={onSelfHost}
        />
        <PillarsSection />
        <OtelSection />
        <HowItWorksSection series={demo.latencySeries} />
        <DemoBandSection
          series={demo.latencySeries}
          query={demo.latencyQuery}
          heartbeat={demo.heartbeatAllUp}
          availabilitySparkline={demo.availabilitySparkline}
          latencySparkline={demo.latencySparkline}
        />
        <UseCasesSection
          series={demo.latencySeries}
          alertRule={demo.alertRule}
          incidentUpdate={demo.incidentUpdate}
          statusRow={demo.statusRows[0]}
          statusUpdatedAt={demo.statusUpdatedAt}
          visitorsSparkline={demo.visitorsSparkline}
          lcpSparkline={demo.lcpSparkline}
        />
        <StatusEmbedSection rows={demo.statusRows} updatedAt={demo.statusUpdatedAt} />
        <SelfHostSection onSelfHostDocs={onSelfHostDocs} />
        <CloudSelfHostSection
          onTryCloud={onTryCloud}
          onSelfHost={onSelfHost}
          onGithub={onGithub}
        />
        <DevelopersSection onGithub={onGithub} />
        <CommunitySection />
        <FaqSection />
        <FinalCtaSection onTryCloud={onTryCloud} onSelfHost={onSelfHost} />
      </main>

      <MarketingFooter
        inline
        showBrand={false}
        columns={FOOTER_COLUMNS}
        copyright={FOOTER_COPYRIGHT}
      />
    </div>
  );
}
