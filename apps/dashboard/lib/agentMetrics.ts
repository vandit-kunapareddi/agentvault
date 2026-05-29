import { prisma } from "./db";
import { computeHealth, type AgentHealth } from "./health";

export interface AgentMetrics {
  todayApprovedSpend: number;
  totalApprovedSpend: number;
  transactionCount: number;
  counts: { approved: number; blocked: number; escalated: number };
  health: AgentHealth;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getAgentMetrics(): Promise<Map<string, AgentMetrics>> {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const hourAgo = new Date(now - 60 * 60 * 1000);
  const tenMinAgo = new Date(now - 10 * 60 * 1000);

  const agents = await prisma.agent.findMany({
    select: {
      id: true,
      dailyCap: true,
      transactions: { select: { status: true, amount: true, createdAt: true } },
    },
  });

  const recentEsc = await prisma.escalation.findMany({
    where: { createdAt: { gte: hourAgo } },
    select: { transaction: { select: { agentId: true } } },
  });
  const escByAgent = new Map<string, number>();
  for (const e of recentEsc) {
    const id = e.transaction.agentId;
    escByAgent.set(id, (escByAgent.get(id) ?? 0) + 1);
  }

  const out = new Map<string, AgentMetrics>();
  for (const a of agents) {
    const counts = { approved: 0, blocked: 0, escalated: 0 };
    let todayApprovedSpend = 0;
    let totalApprovedSpend = 0;
    let blockedLast10Min = 0;
    for (const tx of a.transactions) {
      if (tx.status === "approved") {
        counts.approved += 1;
        totalApprovedSpend += tx.amount;
        if (tx.createdAt >= todayStart) todayApprovedSpend += tx.amount;
      } else if (tx.status === "blocked") {
        counts.blocked += 1;
        if (tx.createdAt >= tenMinAgo) blockedLast10Min += 1;
      } else if (tx.status === "escalated") {
        counts.escalated += 1;
      }
    }
    const escalationsLastHour = escByAgent.get(a.id) ?? 0;
    const health = computeHealth({
      todayApprovedSpend,
      dailyCap: a.dailyCap,
      escalationsLastHour,
      blockedLast10Min,
    });
    out.set(a.id, {
      todayApprovedSpend: round2(todayApprovedSpend),
      totalApprovedSpend: round2(totalApprovedSpend),
      transactionCount: a.transactions.length,
      counts,
      health,
    });
  }
  return out;
}
