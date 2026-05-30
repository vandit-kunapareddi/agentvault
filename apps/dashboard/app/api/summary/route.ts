import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAgentMetrics } from "@/lib/agentMetrics";
import { buildInsights, type InsightForecast } from "@/lib/insights";

const INSIGHTS_LOOKBACK_DAYS = 7;

export interface SummaryResponse {
  agentCount: number;
  todayApprovedTotal: number;
  pendingEscalations: number;
  suggestionsCount: number;
}

export async function GET() {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const insightsSince = new Date(
    Date.now() - INSIGHTS_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );

  const [agentCount, todayApprovedRows, pendingEscalations, recentTx, agents, metrics] =
    await Promise.all([
      prisma.agent.count(),
      prisma.transaction.findMany({
        where: { status: "approved", createdAt: { gte: todayStart } },
        select: { amount: true },
      }),
      prisma.escalation.count({ where: { status: "pending" } }),
      prisma.transaction.findMany({
        where: { createdAt: { gte: insightsSince }, reason: { not: null } },
        select: {
          agentId: true,
          vendor: true,
          amount: true,
          status: true,
          reason: true,
          createdAt: true,
        },
      }),
      prisma.agent.findMany({
        select: { id: true, name: true, dailyCap: true, perTxLimit: true },
      }),
      getAgentMetrics(),
    ]);

  const todayApprovedTotal = todayApprovedRows.reduce((s, r) => s + r.amount, 0);

  const forecasts = new Map<string, InsightForecast>();
  for (const [id, m] of metrics) {
    forecasts.set(id, {
      avgDaily: m.forecast.avgDaily,
      willExceedCap: m.forecast.willExceedCap,
      nearCap: m.forecast.nearCap,
    });
  }
  const insights = buildInsights({ transactions: recentTx, agents, forecasts });

  const res: SummaryResponse = {
    agentCount,
    todayApprovedTotal: Math.round(todayApprovedTotal * 100) / 100,
    pendingEscalations,
    suggestionsCount: insights.length,
  };
  return NextResponse.json(res);
}
