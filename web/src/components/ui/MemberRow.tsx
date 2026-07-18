"use client";

import { clsx } from "clsx";
import type { Member, MemberRole } from "@/models";
import { Avatar } from "./Avatar";
import { Select } from "./Select";

export interface MemberRowProps {
  member: Member;
  onRoleChange?: (role: MemberRole) => void;
  className?: string;
}

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
];

/** MemberRow — §8.2b: avatar + name + email · role select · active/invited/disabled. */
export function MemberRow({ member, onRoleChange, className }: MemberRowProps) {
  return (
    <div
      data-status={member.status}
      className={clsx(
        "font-ui flex items-center gap-3 border-b border-border px-3 py-2",
        member.status === "disabled" && "opacity-60",
        className,
      )}
    >
      <Avatar name={member.name} size={24} src={member.avatar_url} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-[13px] font-medium text-text">
          {member.name}
          {member.status === "invited" && (
            <span className="rounded-(--radius) border border-border px-1 text-[10px] font-medium uppercase tracking-wide text-text-2">
              invited
            </span>
          )}
        </span>
        <span className="truncate text-[12px] text-text-2">{member.email}</span>
      </div>
      <Select
        options={ROLE_OPTIONS}
        value={member.role}
        onValueChange={(v) => onRoleChange?.(v as MemberRole)}
        disabled={member.role === "owner" || member.status === "disabled"}
        aria-label={`Role for ${member.name}`}
        className="w-28 min-w-28"
      />
    </div>
  );
}
