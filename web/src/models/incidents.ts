/** Incidents — data-model.md §5 INCIDENT_V2 + TIMELINE_ENTRY; pages.md B9. */

export type IncidentSev = 1 | 2 | 3 | 4;

/**
 * Lifecycle phases as rendered by the timeline / status page
 * (IncidentHistoryEntry: investigating / identified / monitoring / resolved).
 */
export type IncidentPhase =
  "investigating" | "identified" | "monitoring" | "resolved";

export interface IncidentRoles {
  commander: string;
  responders: string[];
}

export interface Incident {
  id: string;
  org_id: string;
  /** Human key, e.g. `INC-42`. */
  key: string;
  title: string;
  sev: IncidentSev;
  status: IncidentPhase;
  roles: IncidentRoles;
  started_at: string;
  resolved_at: string | null;
  /** Cloud Storage key once a postmortem is attached. */
  postmortem_key: string | null;
  /** Services implicated (feeds status-page linkage). */
  services: string[];
}

export interface TimelineEntry {
  id: string;
  incident_id: string;
  ts: string;
  author: string;
  phase: IncidentPhase;
  body: string;
}

/** One frozen timeline event inside a postmortem (id-less snapshot). */
export interface PostmortemTimelineEvent {
  ts: string;
  phase: IncidentPhase;
  author: string;
  body: string;
}

/**
 * B9 postmortem — the on-resolve template: impact / root-cause / action
 * sections composed by the responder, plus the incident timeline frozen
 * at composition time (auto-filled server-side from the timeline entries).
 * Saving one sets the incident's `postmortem_key`.
 */
export interface Postmortem {
  incident_id: string;
  title: string;
  author: string;
  created_at: string;
  updated_at: string;
  impact: string;
  root_cause: string;
  action_items: string[];
  timeline: PostmortemTimelineEvent[];
}

/** Client-composed postmortem fields (the mock freezes the timeline). */
export type PostmortemInput = Pick<
  Postmortem,
  "author" | "impact" | "root_cause" | "action_items"
>;
