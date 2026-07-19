"use client";

/**
 * Home sections — self-host (A14), cloud vs self-host (A9), for-developers
 * (A13), community (A8), FAQ (A15), final CTA band (A16).
 */

import { Check, ExternalLink, FileText } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CloudVsSelfHostTable } from "@/components/ui/CloudVsSelfHostTable";
import { FAQItem } from "@/components/ui/FAQItem";
import { DiscordIcon, GithubIcon } from "./BrandIcons";
import {
  ARCHITECTURE_FLOW,
  COMPOSE_OUTPUT,
  DISCORD_URL,
  DOCS_URL,
  FAQ_ITEMS,
  GITHUB_URL,
  GOOD_FIRST_ISSUES,
  PLAN_ROWS,
  PROBLEM_CHIPS,
  SELF_HOST_CHECKLIST,
  STACK_LINE,
} from "./content";
import { Section } from "./Section";

/* ------------------------------------------------------------------ */
/* A14 — Self-host                                                      */
/* ------------------------------------------------------------------ */

export interface SelfHostSectionProps {
  onSelfHostDocs?: () => void;
}

export function SelfHostSection({ onSelfHostDocs }: SelfHostSectionProps) {
  return (
    <Section id="self-host" title="Self-host — own your telemetry.">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_480px]">
        <div className="min-w-0 flex flex-col gap-6">
          <p className="max-w-[520px] text-[14px] leading-normal text-text-2">
            Telemetry is your most sensitive exhaust — queries, user paths,
            incident timelines. Keep all of it on infrastructure you control.
          </p>
          <ul className="flex flex-col gap-3">
            {SELF_HOST_CHECKLIST.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-[13px] leading-normal text-text">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-ok" />
                {line}
              </li>
            ))}
          </ul>
          <a
            href={`${DOCS_URL}/self-host`}
            onClick={onSelfHostDocs}
            className="text-[13px] font-medium text-brand transition-colors duration-[var(--duration-fast)] hover:text-brand-deep"
          >
            Self-host docs: docs.upstat.cuesoft.io/self-host →
          </a>
        </div>

        <div className="min-w-0 flex flex-col gap-6">
          <div className="overflow-x-auto rounded-(--radius) border border-border bg-bg-elev p-4">
            <pre className="font-data text-[13px] leading-[1.6]">
              <span className="text-brand">$ docker compose up -d</span>
              {"\n"}
              {COMPOSE_OUTPUT.map((line) => (
                <span key={line} className="text-text-2">
                  {line}
                  {"\n"}
                </span>
              ))}
            </pre>
          </div>
          <div className="flex flex-wrap items-center gap-2" aria-label="Self-host architecture">
            {ARCHITECTURE_FLOW.map((stage, i) => (
              <span key={stage} className="flex items-center gap-2">
                {i > 0 && (
                  <span aria-hidden="true" className="text-[13px] text-text-2">
                    →
                  </span>
                )}
                <span className="rounded-(--radius) border border-border px-2.5 py-1 font-data text-[12px] text-text">
                  {stage}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* A9 — Cloud vs self-host                                              */
/* ------------------------------------------------------------------ */

export interface CloudSelfHostSectionProps {
  onTryCloud: () => void;
  onSelfHost: () => void;
  onGithub: () => void;
}

export function CloudSelfHostSection({
  onTryCloud,
  onSelfHost,
  onGithub,
}: CloudSelfHostSectionProps) {
  return (
    <Section title="Cloud when you want it. Yours when you need it.">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_480px]">
        <CloudVsSelfHostTable
          rows={PLAN_ROWS}
          featureHeader=""
          cloudHeader="Upstat Cloud"
          selfHostCta="Deploy with compose"
          onTryCloud={onTryCloud}
          onSelfHost={onSelfHost}
          className="w-full"
        />
        <div className="min-w-0 flex flex-col gap-5 lg:pt-2">
          <code className="font-data text-[13px]">
            <span className="text-brand">docker compose up -d</span>{" "}
            <span className="text-text-2"># the whole platform, one file</span>
          </code>
          <a
            href={GITHUB_URL}
            onClick={onGithub}
            className="flex items-center gap-2.5 text-[13px] text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            <GithubIcon className="size-6 shrink-0 text-text" />
            github.com/cuesoftinc/upstat — MIT · CONTRIBUTING.md · roadmap
          </a>
          <a
            href={DISCORD_URL}
            className="flex items-center gap-2.5 text-[13px] text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            {/* Discord blurple — brand-glyph color exception (design.md §8.1),
                like the Google 'G' */}
            <DiscordIcon className="size-6 shrink-0 text-[#5865F2]" />
            Discord — CueLABS community
          </a>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* A13 — For developers                                                 */
/* ------------------------------------------------------------------ */

export interface DevelopersSectionProps {
  onGithub: () => void;
}

export function DevelopersSection({ onGithub }: DevelopersSectionProps) {
  return (
    <Section title="For developers — come build it.">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_480px]">
        <div className="min-w-0 flex flex-col gap-5">
          <p className="font-data text-[13px] text-brand">{STACK_LINE}</p>
          <p className="text-[14px] text-text-2">
            upstat is built in the open — and the interesting problems are open
            too:
          </p>
          <div className="flex flex-wrap gap-2">
            {PROBLEM_CHIPS.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-border px-3 py-1 text-[13px] text-text"
              >
                {chip}
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-col gap-3">
            <a
              href={GITHUB_URL}
              onClick={onGithub}
              className="flex items-center gap-2.5 text-[13px] text-text transition-colors duration-[var(--duration-fast)] hover:text-brand"
            >
              <GithubIcon className="size-4 shrink-0" />
              github.com/cuesoftinc/upstat — good first issues welcome
            </a>
            <a
              href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`}
              className="flex items-center gap-2.5 text-[13px] text-text transition-colors duration-[var(--duration-fast)] hover:text-brand"
            >
              <FileText aria-hidden="true" className="size-4 shrink-0" />
              CONTRIBUTING.md — local setup in one script, architecture guide
              included
            </a>
            <a
              href={DISCORD_URL}
              className="flex items-center gap-2.5 text-[13px] text-text transition-colors duration-[var(--duration-fast)] hover:text-brand"
            >
              {/* Discord blurple — brand-glyph color exception (design.md §8.1) */}
              <DiscordIcon className="size-4 shrink-0 text-[#5865F2]" />
              Discord — #upstat-dev on the CueLABS server
            </a>
          </div>
        </div>

        <div className="min-w-0 rounded-(--radius) border border-border bg-bg-elev p-4">
          <p className="font-data text-[12px] text-brand">label: good first issue</p>
          {/* overflow-x-auto: pre text doesn't wrap — scroll inside the card
              at 375w instead of widening the page (CodeSnippet convention) */}
          <pre className="mt-3 overflow-x-auto font-data text-[13px] leading-[1.9] text-text-2">
            {GOOD_FIRST_ISSUES.join("\n")}
          </pre>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* A8 — Community                                                       */
/* ------------------------------------------------------------------ */

export function CommunitySection() {
  return (
    <Section id="community" title="Community">
      <div className="grid items-start gap-12 lg:grid-cols-[1fr_480px]">
        <a
          href={DISCORD_URL}
          className="flex items-start gap-4 rounded-(--radius) border border-border bg-bg-elev p-4 transition-colors duration-[var(--duration-base)] hover:border-text-2"
        >
          {/* Discord blurple — brand-glyph color exception (design.md §8.1) */}
          <DiscordIcon className="mt-1 size-7 shrink-0 text-[#5865F2]" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[14px] font-semibold text-text">
              CueLABS Discord — #upstat
            </span>
            <span className="text-[13px] text-text-2">
              Get help, share dashboards, talk to the maintainers.
            </span>
          </span>
          <span className="shrink-0 text-[13px] font-medium text-brand">Join →</span>
        </a>
        <div className="flex flex-col gap-4 lg:pt-2">
          <a
            href={`${GITHUB_URL}#roadmap`}
            className="text-[13px] font-medium text-brand transition-colors duration-[var(--duration-fast)] hover:text-brand-deep"
          >
            Public roadmap →
          </a>
          <a
            href="https://cuesoft.io"
            className="flex items-center gap-1.5 text-[13px] font-medium text-brand transition-colors duration-[var(--duration-fast)] hover:text-brand-deep"
          >
            CueLABS — more open source from Cuesoft
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* A15 — FAQ (single-open)                                              */
/* ------------------------------------------------------------------ */

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return (
    <Section id="faq" title="Questions, answered.">
      <div className="flex flex-col gap-3">
        {FAQ_ITEMS.map((item, i) => (
          <FAQItem
            key={item.question}
            question={item.question}
            answer={item.answer}
            expanded={openIndex === i}
            onToggle={() => setOpenIndex((cur) => (cur === i ? null : i))}
          />
        ))}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* A16 — Final CTA band                                                 */
/* ------------------------------------------------------------------ */

export interface FinalCtaSectionProps {
  onTryCloud: () => void;
  onSelfHost: () => void;
}

export function FinalCtaSection({ onTryCloud, onSelfHost }: FinalCtaSectionProps) {
  return (
    <section aria-label="Get started" className="border-y border-border bg-bg-elev">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-4 px-6 py-14 text-center">
        <h2 className="text-[26px] font-semibold text-text md:text-[32px]">
          OTLP in. Answers out.
        </h2>
        <p className="text-[14px] text-text-2">
          Self-hosting is free forever — cloud pricing will be announced at GA.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <Button kind="brand" onClick={onTryCloud}>
            Try Cloud
          </Button>
          <Button kind="quiet" onClick={onSelfHost}>
            Self Host
          </Button>
        </div>
      </div>
    </section>
  );
}
