import { useState } from "react";
import { Gauge } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { Modal } from "@/components/ui/Modal";
import { NavRail, NavRailItem } from "@/components/ui/NavRail";
import { ShortcutCheatsheet } from "@/components/ui/ShortcutCheatsheet";
import { StatusPageComponentRow } from "@/components/ui/StatusPageComponentRow";
import { StatusPageHeader } from "@/components/ui/StatusPageHeader";
import { TopBar } from "@/components/ui/TopBar";
import { TimePickerDemo } from "./gallery-controls";
import { Cell, Section } from "./gallery-layout";
import { DAYS_90 } from "./gallery-fixtures";

function OverlaysDemo() {
  const [modal, setModal] = useState<"sm" | "lg" | "sheet" | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  return (
    <div className="flex flex-wrap gap-[var(--space-2)]">
      <Button kind="quiet" onClick={() => setModal("sm")}>
        Open modal (sm)
      </Button>
      <Button kind="quiet" onClick={() => setModal("lg")}>
        Open modal (lg)
      </Button>
      <Button kind="quiet" onClick={() => setModal("sheet")}>
        Open sheet
      </Button>
      <Button kind="quiet" onClick={() => setPaletteOpen(true)}>
        Command palette
      </Button>
      <Button kind="quiet" onClick={() => setCheatsheetOpen(true)}>
        Shortcut cheatsheet (?)
      </Button>
      {modal && (
        <Modal
          open
          onClose={() => setModal(null)}
          title={modal === "sheet" ? "Monitor detail" : "Declare incident"}
          variant={modal}
          footer={
            <>
              <Button kind="quiet" onClick={() => setModal(null)}>
                Cancel
              </Button>
              <Button kind="brand" onClick={() => setModal(null)}>
                Confirm
              </Button>
            </>
          }
        >
          <p className="text-[13px] leading-[1.45] text-text-2">
            Body slot — z layer sheet/modal 40, header + body + footer actions.
          </p>
        </Modal>
      )}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={[
          { id: "1", label: "Go to dashboards", kbd: "g d" },
          { id: "2", label: "Go to logs", kbd: "g l" },
          { id: "3", label: "Checkout health (dashboard)" },
        ]}
      />
      <ShortcutCheatsheet
        open={cheatsheetOpen}
        onClose={() => setCheatsheetOpen(false)}
      />
    </div>
  );
}

export function ChromeDemos() {
  return (
    <>
      <Section title="App chrome">
        <Cell label="NavRail (12 pillars) + flyout labels">
          <div className="h-[420px] overflow-hidden rounded-(--radius) border border-border">
            <NavRail activeKey="logs" />
          </div>
        </Cell>
        <Cell label="NavRailItem default / active">
          <div className="flex gap-[var(--space-2)]">
            <NavRailItem icon={Gauge} label="Metrics" />
            <NavRailItem icon={Gauge} label="Metrics" active />
          </div>
        </Cell>
        <Cell label="TopBar org · time · search (/) · bell (MI-14)" grow>
          <div className="flex flex-col gap-[var(--space-2)]">
            <TopBar
              orgName="Upstat"
              env="prod"
              timePicker={<TimePickerDemo />}
              unreadCount={3}
            />
            <TopBar orgName="Upstat" env="staging" unreadCount={0} />
          </div>
        </Cell>
        <Cell
          label="Overlays — Modal sm/lg · Sheet · CommandPalette · ShortcutCheatsheet"
          grow
        >
          <OverlaysDemo />
        </Cell>
      </Section>

      <Section title="Status page">
        <Cell label="StatusPageHeader ×4" grow>
          <div className="flex flex-col gap-[var(--space-2)]">
            <StatusPageHeader
              orgName="Upstat"
              overall="operational"
              lastUpdated="2026-07-18T12:00:00Z"
            />
            <StatusPageHeader
              orgName="Upstat"
              overall="degraded"
              lastUpdated="2026-07-18T12:00:00Z"
            />
            <StatusPageHeader
              orgName="Upstat"
              overall="partial_outage"
              lastUpdated="2026-07-18T12:00:00Z"
            />
            <StatusPageHeader
              orgName="Upstat"
              overall="major_outage"
              lastUpdated="2026-07-18T12:00:00Z"
            />
          </div>
        </Cell>
        <Cell label="StatusPageComponentRow (90-day strip)" grow>
          <div className="flex flex-col">
            <StatusPageComponentRow
              name="API"
              status="ok"
              days={DAYS_90}
              uptimePct={99.87}
            />
            <StatusPageComponentRow
              name="Ingest"
              status="crit"
              days={DAYS_90}
              uptimePct={98.02}
            />
            <StatusPageComponentRow
              name="Status page"
              status="nodata"
              days={DAYS_90}
              uptimePct={null}
            />
          </div>
        </Cell>
      </Section>
    </>
  );
}
