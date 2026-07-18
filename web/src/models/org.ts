/** Org — data-model.md §5. Tier-1-minimal identity: name + IANA timezone (X-10). */
export interface Org {
  id: string;
  name: string;
  /** IANA timezone, default UTC — display bucketing only, storage stays UTC. */
  timezone: string;
  created_at: string;
}

/** Onboarding state for the B1 first-run flow (create-org → send-your-first-data). */
export interface OnboardingState {
  org_created: boolean;
  /** True once the org has received its first datapoint (MI-16 radar resolves). */
  has_data: boolean;
  /** Ingestion key surfaced on the getting-started screen. */
  ingest_key?: string;
}

export type MemberRole = "owner" | "admin" | "member";
export type MemberStatus = "active" | "invited" | "disabled";

/** Member — pages.md B12 org/members/roles; MemberRow contract (§8.2b). */
export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  avatar_url?: string;
}
