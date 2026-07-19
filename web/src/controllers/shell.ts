"use client";

/**
 * App-shell controller — TopBar chrome state: org + switcher (the second,
 * empty org walks onboarding, web-implementation.md §6), the alert bell
 * (MI-14), and the persistent IncidentBanner while a sev1/2 is open.
 */

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { Incident } from "@/models";
import { alertsRepo, incidentsRepo, orgsRepo } from "@/models/repositories";
import { useRequest } from "./use-request";

export function ageLabel(iso: string, now = Date.now()): string {
  const min = Math.max(Math.round((now - Date.parse(iso)) / 60_000), 0);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function useShellController() {
  const router = useRouter();
  const org = useRequest(() => orgsRepo.current(), []);
  const orgs = useRequest(() => orgsRepo.list(), []);
  const feed = useRequest(() => alertsRepo.feed(), []);
  const incidents = useRequest(() => incidentsRepo.list(), []);

  const switchOrg = useCallback(async (id: string) => {
    await orgsRepo.activate(id);
    // full reload — every controller on screen re-seeds from the new org
    window.location.assign("/dashboard");
  }, []);

  const newOrg = useCallback(() => {
    router.push("/dashboard/onboarding");
  }, [router]);

  const unread = (feed.data ?? []).filter((e) => e.unread).length;

  // MI-14: persistent banner while any sev1/2 incident is open.
  const bannerIncident: Incident | null =
    (incidents.data ?? []).find((i) => i.status !== "resolved" && i.sev <= 2) ?? null;

  return { org, orgs, feed, incidents, unread, bannerIncident, switchOrg, newOrg };
}
