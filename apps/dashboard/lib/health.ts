export type AgentHealth = "healthy" | "warning" | "critical";

export interface HealthInput {
  todayApprovedSpend: number;
  dailyCap: number;
  escalationsLastHour: number;
  blockedLast10Min: number;
}

export function computeHealth(i: HealthInput): AgentHealth {
  if (i.dailyCap > 0 && i.todayApprovedSpend > i.dailyCap) return "critical";
  if (i.escalationsLastHour > 3) return "critical";
  if (i.blockedLast10Min > 0) return "critical";
  const ratio = i.dailyCap > 0 ? i.todayApprovedSpend / i.dailyCap : 0;
  if (ratio >= 0.8) return "warning";
  if (i.escalationsLastHour >= 1) return "warning";
  return "healthy";
}

export const healthDot: Record<AgentHealth, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

export const healthRing: Record<AgentHealth, string> = {
  healthy: "bg-emerald-400",
  warning: "bg-amber-400",
  critical: "bg-red-400",
};

export const healthLabel: Record<AgentHealth, string> = {
  healthy: "Healthy",
  warning: "Warning",
  critical: "Critical",
};
