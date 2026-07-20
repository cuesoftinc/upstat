import { redirect } from "next/navigation";
import { FIRST_SETTINGS_TAB } from "./tabs";

/**
 * B12 `/dashboard/settings` — live IA (ratified 2026-07-20): the bare
 * route lands on the first settings tab; every section is a routed tab
 * at /dashboard/settings/<tab> (§4 route map).
 */
export default function SettingsPage() {
  redirect(FIRST_SETTINGS_TAB);
}
