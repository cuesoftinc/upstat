"use client";

import { useCallback } from "react";
import { keysRepo, membersRepo, usageRepo } from "@/models/repositories";
import type { ApiKey, MemberRole } from "@/models";
import { useRequest } from "./use-request";

/** Settings controller — API keys/tokens + members (pages.md B12). */
export function useSettingsController() {
  const keys = useRequest(() => keysRepo.list(), []);
  const members = useRequest(() => membersRepo.list(), []);

  const createKey = useCallback(
    async (input: {
      kind: ApiKey["kind"];
      name: string;
      scope: ApiKey["scope"];
    }) => {
      const created = await keysRepo.create(input);
      await keys.reload();
      return created; // carries the one-time secret
    },
    [keys],
  );

  const rotateKey = useCallback(
    async (id: string) => {
      const rotated = await keysRepo.rotate(id);
      await keys.reload();
      return rotated;
    },
    [keys],
  );

  const revokeKey = useCallback(
    async (id: string) => {
      await keysRepo.revoke(id);
      await keys.reload();
    },
    [keys],
  );

  const inviteMember = useCallback(
    async (email: string, role: MemberRole) => {
      await membersRepo.invite({ email, role });
      await members.reload();
    },
    [members],
  );

  const setMemberRole = useCallback(
    async (id: string, role: MemberRole) => {
      await membersRepo.setRole(id, role);
      await members.reload();
    },
    [members],
  );

  return {
    keys,
    members,
    createKey,
    rotateKey,
    revokeKey,
    inviteMember,
    setMemberRole,
  };
}

/**
 * B12 usage metering ([Designed 2026-07-20], OBS-012) — the month-to-date
 * per-pillar meters, computed by the mock from the seeded telemetry.
 */
export function useUsageController() {
  return useRequest(() => usageRepo.report(), []);
}
