let counter = 0;

/** Client-side draft ids for new builder rows (server re-keys on save). */
export function nextComponentId(): string {
  counter += 1;
  return `draft_spc_${counter}`;
}
