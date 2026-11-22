import { useState } from "react";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { BufferedCountChip, CountBadge } from "@/components/ui/CountBadge";
import { FacetGroup } from "@/components/ui/FacetGroup";
import { GoogleAuthButton } from "@/components/ui/GoogleAuthButton";
import { Input } from "@/components/ui/Input";
import { KbdChip } from "@/components/ui/KbdChip";
import { LevelChip } from "@/components/ui/LevelChip";
import { QueryBar } from "@/components/ui/QueryBar";
import { QueryPill } from "@/components/ui/QueryPill";
import { SavedViewChip } from "@/components/ui/SavedViewChip";
import { Select } from "@/components/ui/Select";
import { SevChip } from "@/components/ui/SevChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { Switch } from "@/components/ui/Switch";
import { TimePicker, type TimePreset } from "@/components/ui/TimePicker";
import { Toast } from "@/components/ui/Toast";
import { Tooltip } from "@/components/ui/Tooltip";
import { ZoomStackChip } from "@/components/ui/ZoomStackChip";
import { Cell, Section } from "./gallery-layout";
import { STATUSES } from "./gallery-fixtures";

const TIMEZONES = [
  "Africa/Lagos",
  "Africa/Nairobi",
  "America/New_York",
  "America/Sao_Paulo",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Europe/Berlin",
  "Europe/London",
  "UTC",
].map((tz) => ({ value: tz, label: tz }));

export function TimePickerDemo() {
  const [value, setValue] = useState<TimePreset | "custom">("1h");
  const [live, setLive] = useState(true);
  return (
    <TimePicker
      value={value}
      onChange={setValue}
      live={live}
      onLiveChange={setLive}
    />
  );
}

function QueryBarDemo({ syntaxError }: { syntaxError?: string }) {
  const [text, setText] = useState(syntaxError ? "serivce:web" : "");
  const [pills, setPills] = useState([
    { facet: "service", value: "checkout" },
    { facet: "status", value: "error", negated: true },
  ]);
  return (
    <QueryBar
      pills={pills}
      onRemovePill={(i) => setPills((p) => p.filter((_, j) => j !== i))}
      text={text}
      onTextChange={setText}
      suggestions={
        text
          ? [
              { text: "service:", cardinality: 7 },
              { text: "status:", cardinality: 4 },
            ]
          : []
      }
      syntaxError={syntaxError ?? null}
    />
  );
}

function FacetGroupDemo() {
  const [selected, setSelected] = useState<string[]>(["checkout"]);
  return (
    <FacetGroup
      name="service"
      values={[
        { value: "api-common", count: 4021 },
        { value: "checkout", count: 1210 },
        { value: "worker", count: 887 },
        { value: "ingest-gw", count: 640 },
        { value: "clickhouse", count: 212 },
      ]}
      selected={selected}
      onToggle={(v) =>
        setSelected((s) =>
          s.includes(v) ? s.filter((x) => x !== v) : [...s, v],
        )
      }
      topN={3}
    />
  );
}

export function SelectDemo({
  typeahead,
  disabled,
}: {
  typeahead?: boolean;
  disabled?: boolean;
}) {
  const [value, setValue] = useState<string | null>("Africa/Lagos");
  return (
    <Select
      options={TIMEZONES}
      value={value}
      onValueChange={setValue}
      typeahead={typeahead}
      disabled={disabled}
      aria-label="Org timezone"
      className="w-64"
    />
  );
}

export function SwitchDemo({ disabled }: { disabled?: boolean }) {
  const [on, setOn] = useState(true);
  return (
    <Switch
      checked={on}
      onCheckedChange={setOn}
      disabled={disabled}
      aria-label="Demo switch"
    />
  );
}

function CheckboxDemo() {
  const [checked, setChecked] = useState<boolean | "indeterminate">(
    "indeterminate",
  );
  return (
    <Checkbox
      checked={checked}
      onCheckedChange={(next) => setChecked(next)}
      aria-label="Demo checkbox"
    />
  );
}

export function ControlDemos() {
  return (
    <>
      <FormDemos />
      <BadgeDemos />
      <FeedbackDemos />
      <QueryControlDemos />
    </>
  );
}

function FormDemos() {
  return (
    <Section title="Button · Input · GoogleAuthButton">
      <Cell label="Button kind × size × disabled">
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          <Button kind="brand">Create monitor</Button>
          <Button kind="quiet">Cancel</Button>
          <Button kind="destructive">Delete</Button>
          <Button kind="brand" size="sm">
            Save
          </Button>
          <Button kind="quiet" size="sm">
            Duplicate
          </Button>
          <Button kind="brand" disabled>
            Disabled
          </Button>
        </div>
      </Cell>
      <Cell label="Input default / mono / error / disabled">
        <div className="flex w-72 flex-col gap-[var(--space-2)]">
          <Input placeholder="Monitor name" aria-label="Monitor name" />
          <Input
            mono
            defaultValue="service:checkout | p95()"
            aria-label="Query"
          />
          <Input
            error
            errorMessage="Must be a valid HTTPS URL"
            defaultValue="not-a-url"
            aria-label="Target"
          />
          <Input disabled placeholder="Disabled" aria-label="Disabled input" />
        </div>
      </Cell>
      <Cell label="GoogleAuthButton default / loading">
        <div className="flex w-72 flex-col gap-[var(--space-2)]">
          <GoogleAuthButton />
          <GoogleAuthButton loading />
        </div>
      </Cell>
    </Section>
  );
}

function BadgeDemos() {
  return (
    <Section title="Pills & chips">
      <Cell label="StatusPill ×6 + dot-only (crit breathes, MI-8)">
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          {STATUSES.map((s) => (
            <StatusPill key={s} status={s} />
          ))}
          <StatusPill status="crit" dotOnly />
        </div>
      </Cell>
      <Cell label="QueryPill default / negated">
        <div className="flex gap-[var(--space-2)]">
          <QueryPill
            facet="service"
            value="api-common"
            onRemove={() => undefined}
          />
          <QueryPill
            facet="status"
            value="error"
            negated
            onRemove={() => undefined}
          />
        </div>
      </Cell>
      <Cell label="LevelChip ×5">
        <div className="flex gap-[var(--space-2)]">
          {(["TRACE", "DEBUG", "INFO", "WARN", "ERROR"] as const).map((l) => (
            <LevelChip key={l} level={l} />
          ))}
        </div>
      </Cell>
      <Cell label="SevChip ×3">
        <div className="flex gap-[var(--space-2)]">
          <SevChip sev={1} />
          <SevChip sev={2} />
          <SevChip sev={3} />
        </div>
      </Cell>
      <Cell label="CountBadge idle / pulse · BufferedCountChip (MI-4)">
        <div className="flex items-center gap-[var(--space-3)]">
          <CountBadge count={3} />
          <CountBadge count={128} pulse />
          <BufferedCountChip count={128} onClick={() => undefined} />
        </div>
      </Cell>
      <Cell label="KbdChip single / chord">
        <div className="flex items-center gap-[var(--space-3)]">
          <KbdChip keys="/" />
          <KbdChip keys="g d" />
          <KbdChip keys="⌘ k" />
        </div>
      </Cell>
      <Cell label="SavedViewChip personal / org-shared / active (MI-18)">
        <div className="flex gap-[var(--space-2)]">
          <SavedViewChip name="prod errors" />
          <SavedViewChip
            name="checkout p95"
            sharedWith={["Ibukun Dairo", "Sade Balogun"]}
          />
          <SavedViewChip name="ingest health" active />
        </div>
      </Cell>
      <Cell label="ZoomStackChip (MI-3)">
        <ZoomStackChip
          depth={2}
          label="09:12 – 09:40"
          onReset={() => undefined}
        />
      </Cell>
    </Section>
  );
}

function FeedbackDemos() {
  return (
    <Section title="Toast · Tooltip · Avatar · Switch · Checkbox · Skeleton">
      <Cell label="Toast ×3">
        <div className="flex flex-col gap-[var(--space-2)]">
          <Toast
            kind="info"
            message="Dashboard exported as JSON."
            onDismiss={() => undefined}
          />
          <Toast
            kind="success"
            message="Monitor created."
            onDismiss={() => undefined}
          />
          <Toast
            kind="error"
            message="channel_unverified — verify the webhook first."
            onDismiss={() => undefined}
          />
        </div>
      </Cell>
      <Cell label="Tooltip text / multi-metric (hover)">
        <div className="flex gap-[var(--space-4)] pt-[var(--space-6)]">
          <Tooltip content="Copy query">
            <Button kind="quiet" size="sm">
              text
            </Button>
          </Tooltip>
          <Tooltip
            placement="bottom"
            content={[
              { label: "throughput", value: "1.2k req/s" },
              { label: "error", value: "0.42%" },
              { label: "latency", value: "142 ms" },
            ]}
          >
            <Button kind="quiet" size="sm">
              multi-metric
            </Button>
          </Tooltip>
        </div>
      </Cell>
      <Cell label="Avatar 20/24 · image · AvatarStack +n">
        <div className="flex items-center gap-[var(--space-3)]">
          <Avatar name="Ibukun Dairo" size={20} />
          <Avatar name="Sade Balogun" size={24} />
          <Avatar name="Repo Owner" size={24} src="/favicon.ico" />
          <AvatarStack
            names={[
              "Ibukun Dairo",
              "Sade Balogun",
              "Tunde Alao",
              "Chi Obi",
              "Ade King",
              "Zara Bello",
            ]}
          />
        </div>
      </Cell>
      <Cell label="Switch on/off/disabled">
        <div className="flex items-center gap-[var(--space-3)]">
          <SwitchDemo />
          <Switch
            checked={false}
            onCheckedChange={() => undefined}
            aria-label="Off switch"
          />
          <Switch checked disabled aria-label="Disabled switch" />
        </div>
      </Cell>
      <Cell label="Checkbox checked / indeterminate / disabled">
        <div className="flex items-center gap-[var(--space-3)]">
          <Checkbox
            checked
            onCheckedChange={() => undefined}
            aria-label="Checked"
          />
          <CheckboxDemo />
          <Checkbox checked={false} disabled aria-label="Disabled" />
        </div>
      </Cell>
      <Cell label="Skeleton line / value / panel-axis (static under reduced motion)">
        <div className="flex w-72 flex-col gap-[var(--space-2)]">
          <Skeleton kind="line" />
          <Skeleton kind="value" />
          <Skeleton kind="panel-axis" className="h-24" />
        </div>
      </Cell>
    </Section>
  );
}

function QueryControlDemos() {
  return (
    <Section title="TimePicker · QueryBar · FacetGroup · Select">
      <Cell label="TimePicker presets + custom + live">
        <TimePickerDemo />
      </Cell>
      <Cell label="QueryBar pills + autocomplete" grow>
        <QueryBarDemo />
      </Cell>
      <Cell label="QueryBar syntax-error (MI-13)" grow>
        <QueryBarDemo syntaxError="unknown facet: serivce — did you mean service:?" />
      </Cell>
      <Cell label="FacetGroup top-N + counts (MI-6)">
        <div className="w-64">
          <FacetGroupDemo />
        </div>
      </Cell>
      <Cell label="Select / DropdownMenu · type-ahead (X-10) · disabled">
        <div className="flex flex-col gap-[var(--space-2)]">
          <SelectDemo />
          <SelectDemo typeahead />
          <SelectDemo disabled />
        </div>
      </Cell>
    </Section>
  );
}
