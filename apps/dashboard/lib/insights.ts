export type InsightType =
  | "whitelist"
  | "perTxLimit"
  | "dailyCap"
  | "vendorLimit"
  | "forecast";

export type InsightSeverity = "info" | "warning" | "critical";

export interface Insight {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  agentId: string;
  agentName: string;
  vendor?: string;
  count: number;
  message: string;
  suggestion: string;
}

export interface InsightTxRow {
  agentId: string;
  vendor: string;
  amount: number;
  status: string;
  reason: string | null;
  createdAt: Date;
}

export interface InsightAgent {
  id: string;
  name: string;
  dailyCap: number;
  perTxLimit: number;
}

const WHITELIST_RE = /Vendor "([^"]+)" is not on the approved list/;
const PER_TX_RE = /Amount \$([\d.]+) exceeds per-transaction limit \$([\d.]+)/;
const DAILY_CAP_RE = /(?:Would exceed|Near) daily cap/;
const VENDOR_LIMIT_RE = /Vendor limit reached: \$([\d.]+) of \$([\d.]+) daily limit used for (\S+)/;

// Whitelist hits are signal even on first occurrence ("you just escalated for
// this — want to whitelist?"). The other patterns need at least two events
// before we call them a "pattern" worth surfacing.
const MIN_WHITELIST = 1;
const MIN_OTHER = 2;

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export function buildInsights(input: {
  transactions: InsightTxRow[];
  agents: InsightAgent[];
}): Insight[] {
  const agentMap = new Map(input.agents.map((a) => [a.id, a]));

  const whitelistByKey = new Map<
    string,
    { agentId: string; vendor: string; count: number }
  >();
  const perTxByAgent = new Map<
    string,
    { agentId: string; count: number; maxAttempted: number; limit: number }
  >();
  const dailyCapByAgent = new Map<
    string,
    { agentId: string; count: number }
  >();
  const vendorLimitByKey = new Map<
    string,
    { agentId: string; vendor: string; count: number; limit: number }
  >();

  for (const tx of input.transactions) {
    const reason = tx.reason ?? "";

    // Whitelist trigger — captured wherever the underlying flag appears
    // (direct block, escalation reason, or resolved-escalation reason).
    const w = reason.match(WHITELIST_RE);
    if (w) {
      const vendor = w[1];
      const key = `${tx.agentId}|${vendor}`;
      const cur = whitelistByKey.get(key);
      if (cur) cur.count += 1;
      else whitelistByKey.set(key, { agentId: tx.agentId, vendor, count: 1 });
    }

    if (tx.status === "blocked") {
      const p = reason.match(PER_TX_RE);
      if (p) {
        const attempted = Number(p[1]);
        const limit = Number(p[2]);
        const cur = perTxByAgent.get(tx.agentId);
        if (cur) {
          cur.count += 1;
          if (attempted > cur.maxAttempted) cur.maxAttempted = attempted;
        } else {
          perTxByAgent.set(tx.agentId, {
            agentId: tx.agentId,
            count: 1,
            maxAttempted: attempted,
            limit,
          });
        }
      }

      const v = reason.match(VENDOR_LIMIT_RE);
      if (v) {
        const limit = Number(v[2]);
        const vendor = v[3];
        const key = `${tx.agentId}|${vendor}`;
        const cur = vendorLimitByKey.get(key);
        if (cur) cur.count += 1;
        else
          vendorLimitByKey.set(key, {
            agentId: tx.agentId,
            vendor,
            count: 1,
            limit,
          });
      }
    }

    // Daily-cap pressure: count both direct blocks AND near-cap escalations
    // from the same agent so the insight reflects all near-cap pressure.
    if (DAILY_CAP_RE.test(reason)) {
      const cur = dailyCapByAgent.get(tx.agentId);
      if (cur) cur.count += 1;
      else dailyCapByAgent.set(tx.agentId, { agentId: tx.agentId, count: 1 });
    }
  }

  const out: Insight[] = [];

  for (const v of whitelistByKey.values()) {
    if (v.count < MIN_WHITELIST) continue;
    const agent = agentMap.get(v.agentId);
    if (!agent) continue;
    out.push({
      id: `whitelist:${v.agentId}:${v.vendor}`,
      type: "whitelist",
      severity: v.count >= 3 ? "warning" : "info",
      agentId: v.agentId,
      agentName: agent.name,
      vendor: v.vendor,
      count: v.count,
      message: `Tried the unlisted vendor ${v.vendor} ${plural(v.count, "time")} this week.`,
      suggestion: `Add ${v.vendor} to ${agent.name}'s approved vendors to stop these escalations.`,
    });
  }

  for (const v of perTxByAgent.values()) {
    if (v.count < MIN_OTHER) continue;
    const agent = agentMap.get(v.agentId);
    if (!agent) continue;
    const suggested = Math.ceil(v.maxAttempted * 1.1 * 100) / 100;
    out.push({
      id: `perTxLimit:${v.agentId}`,
      type: "perTxLimit",
      severity: "warning",
      agentId: v.agentId,
      agentName: agent.name,
      count: v.count,
      message: `Blocked ${plural(v.count, "time")} for exceeding the $${v.limit.toFixed(2)} per-transaction limit. Largest attempt: $${v.maxAttempted.toFixed(2)}.`,
      suggestion: `If these are legitimate, consider raising the per-transaction limit to about $${suggested.toFixed(2)}.`,
    });
  }

  for (const v of dailyCapByAgent.values()) {
    if (v.count < MIN_OTHER) continue;
    const agent = agentMap.get(v.agentId);
    if (!agent) continue;
    out.push({
      id: `dailyCap:${v.agentId}`,
      type: "dailyCap",
      severity: v.count >= 4 ? "critical" : "warning",
      agentId: v.agentId,
      agentName: agent.name,
      count: v.count,
      message: `Hit or neared its $${agent.dailyCap.toFixed(2)} daily cap ${plural(v.count, "time")} this week.`,
      suggestion: `Either raise the cap or investigate whether this agent is doing more than expected.`,
    });
  }

  for (const v of vendorLimitByKey.values()) {
    if (v.count < MIN_OTHER) continue;
    const agent = agentMap.get(v.agentId);
    if (!agent) continue;
    out.push({
      id: `vendorLimit:${v.agentId}:${v.vendor}`,
      type: "vendorLimit",
      severity: "warning",
      agentId: v.agentId,
      agentName: agent.name,
      vendor: v.vendor,
      count: v.count,
      message: `Blocked ${plural(v.count, "time")} by the $${v.limit.toFixed(2)} daily limit for ${v.vendor}.`,
      suggestion: `Raise or remove the per-vendor limit for ${v.vendor} if this volume is expected.`,
    });
  }

  const sevOrder: Record<InsightSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
  };
  out.sort((a, b) => {
    const s = sevOrder[a.severity] - sevOrder[b.severity];
    if (s !== 0) return s;
    return b.count - a.count;
  });
  return out;
}
