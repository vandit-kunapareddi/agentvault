import type { CheckpointStatus, Protocol } from "@agentvault/types";

export const statusPill: Record<CheckpointStatus, string> = {
  approved:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  blocked: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  escalated:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  recognized: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
};

export const statusDot: Record<CheckpointStatus, string> = {
  approved: "bg-emerald-500",
  blocked: "bg-red-500",
  escalated: "bg-amber-500",
  recognized: "bg-sky-500",
};

export const statusLabel: Record<CheckpointStatus, string> = {
  approved: "Approved",
  blocked: "Blocked",
  escalated: "Escalated",
  recognized: "Recognized",
};

export function isCheckpointStatus(value: unknown): value is CheckpointStatus {
  return (
    value === "approved" ||
    value === "blocked" ||
    value === "escalated" ||
    value === "recognized"
  );
}

const protocolBadgeStyles: Record<Protocol, string> = {
  x402: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  mpp: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  acp: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  unknown: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function protocolBadge(protocol: string): string {
  return protocolBadgeStyles[protocol as Protocol] ?? protocolBadgeStyles.unknown;
}

export function protocolLabel(protocol: string): string {
  return protocol === "unknown" ? "—" : protocol.toUpperCase();
}

export function trustTierBadge(tier: string | null | undefined): string {
  switch (tier) {
    case "verified":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "probation":
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
    case "expired":
      return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
    default:
      return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
  }
}
