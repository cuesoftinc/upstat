"use client";

import { useCallback } from "react";
import { keysRepo, membersRepo } from "@/models/repositories";
import type { ApiKey, MemberRole } from "@/models";
import { useRequest } from "./use-request";

/** Settings controller — API keys/tokens + members (pages.md B12). */
export function useSettingsController() {
  const keys = useRequest(() => keysRepo.list(), []);
  const members = useRequest(() => membersRepo.list(), []);

  const createKey = useCallback(
    async (input: { kind: ApiKey["kind"]; name: string; scope: ApiKey["scope"] }) => {
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

  return { keys, members, createKey, rotateKey, revokeKey, inviteMember, setMemberRole };
}
