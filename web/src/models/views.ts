/** Saved views — MI-18: a named filter set morphs the QueryBar into a chip. */

export type SavedViewScope = "personal" | "org";

/** Explorer surface the view belongs to. */
export type SavedViewSurface = "logs" | "metrics" | "traces";

export interface SavedView {
  id: string;
  name: string;
  scope: SavedViewScope;
  surface: SavedViewSurface;
  /** The QueryBar contents (shared grammar, query-grammar.md §1). */
  query: string;
  /** Org-shared views carry the sharer avatar stack (§8.2b SavedViewChip). */
  shared_with?: string[];
  created_at: string;
}
