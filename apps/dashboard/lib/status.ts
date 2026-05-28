import type { CheckpointStatus } from "@agentvault/types";

export const statusPill: Record<CheckpointStatus, string> = {
  approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  escalated:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
};

export const statusDot: Record<CheckpointStatus, string> = {
  approved: "bg-emerald-500",
  blocked: "bg-red-500",
  escalated: "bg-amber-500",
};

export const statusLabel: Record<CheckpointStatus, string> = {
  approved: "Approved",
  blocked: "Blocked",
  escalated: "Escalated",
};

export function isCheckpointStatus(value: unknown): value is CheckpointStatus {
  return value === "approved" || value === "blocked" || value === "escalated";
}
