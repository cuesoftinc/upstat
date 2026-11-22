import { useState } from "react";
import { CloudVsSelfHostTable } from "@/components/ui/CloudVsSelfHostTable";
import { CodeSnippet } from "@/components/ui/CodeSnippet";
import { FAQItem } from "@/components/ui/FAQItem";
import { MarketingFooter } from "@/components/ui/MarketingFooter";
import { MarketingNav } from "@/components/ui/MarketingNav";
import { MARKETING_PILLARS, PillarCard } from "@/components/ui/PillarCard";
import { Cell, Section } from "./gallery-layout";

const SELF_HOST_SNIPPET_TABS = [
  {
    label: "Docker Compose",
    code: "git clone https://github.com/cuesoftinc/upstat\ncd upstat && docker compose up --build -d",
  },
  {
    label: "Helm",
    code: "git clone https://github.com/cuesoftinc/upstat\ncd upstat && helm install upstat deploy/helm",
  },
];

const SNIPPET_TABS = [
  {
    label: "Go",
    code: `exporter, _ := otlptracehttp.New(ctx)\ntp := sdktrace.NewTracerProvider(sdktrace.WithBatcher(exporter))\notel.SetTracerProvider(tp)`,
  },
  {
    label: "Python",
    code: `from opentelemetry import trace\nprovider = TracerProvider()\nprovider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))`,
  },
  {
    label: "Node",
    code: `import { NodeSDK } from "@opentelemetry/sdk-node";\nconst sdk = new NodeSDK({ traceExporter: new OTLPTraceExporter() });\nsdk.start();`,
  },
  {
    label: "k8s",
    code: `helm install upstat-agent upstat/agent \\\n  --set ingest.endpoint=https://ingest.upstat.cuesoft.io:4318`,
  },
];

function FAQDemo() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const faqs = [
    {
      q: "Is everything open-source?",
      a: "Yes — the whole platform is MIT licensed; cloud runs the same code.",
    },
    {
      q: "Do you use cookies for analytics?",
      a: "No. RUM is cookieless by design — the event schema is the privacy boundary.",
    },
  ];
  return (
    <div className="flex w-full max-w-[720px] flex-col">
      {faqs.map((f, i) => (
        <FAQItem
          key={f.q}
          question={f.q}
          answer={f.a}
          expanded={openIndex === i}
          onToggle={() => setOpenIndex((cur) => (cur === i ? null : i))}
        />
      ))}
    </div>
  );
}

export function MarketingDemos() {
  return (
    <Section title="Marketing (Stage-5 kit)">
      <Cell
        label="MarketingNav (parity canon rev: 4 links · star badge · theme toggle · Sign in · Try Cloud)"
        grow
      >
        <div className="overflow-hidden rounded-(--radius) border border-border">
          <MarketingNav starCount={1284} />
        </div>
      </Cell>
      <Cell label="PillarCard ×8 (compact grid)" grow>
        <div className="grid max-w-[720px] grid-cols-2 gap-[var(--space-3)] md:grid-cols-4">
          {MARKETING_PILLARS.map((p) => (
            <PillarCard key={p.pillar} {...p} compact />
          ))}
        </div>
      </Cell>
      <Cell label="PillarCard full">
        <PillarCard {...MARKETING_PILLARS[4]} className="w-72" />
      </Cell>
      <Cell label="CodeSnippet + Tabs (Go/Python/Node/k8s, copy ✓)" grow>
        <CodeSnippet tabs={SNIPPET_TABS} className="max-w-[640px]" />
      </Cell>
      <Cell
        label="CodeSnippet + Tabs, prompt mode (A14: Docker Compose | Helm)"
        grow
      >
        <CodeSnippet
          tabs={SELF_HOST_SNIPPET_TABS}
          tabsLabel="Install method"
          prompt
          className="max-w-[640px]"
        />
      </Cell>
      <Cell label="CloudVsSelfHostTable (A9)" grow>
        <CloudVsSelfHostTable className="max-w-[640px]" />
      </Cell>
      <Cell label="FAQItem single-open accordion (A15)" grow>
        <FAQDemo />
      </Cell>
      <Cell label="MarketingFooter" grow>
        <div className="overflow-hidden rounded-(--radius) border border-border">
          <MarketingFooter />
        </div>
      </Cell>
    </Section>
  );
}
