/** Service catalog — data-model.md §5 SERVICE_ENTRY; pages.md B11. */

export interface TelemetryPresence {
  metrics: boolean;
  logs: boolean;
  traces: boolean;
  rum: boolean;
}

export interface ServiceCatalogEntry {
  id: string;
  name: string;
  owner: string;
  links: {
    repo?: string;
    runbook?: string;
  };
  environments: string[];
  telemetry: TelemetryPresence;
}
