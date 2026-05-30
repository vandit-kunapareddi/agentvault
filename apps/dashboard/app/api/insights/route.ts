import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAgentMetrics } from "@/lib/agentMetrics";
import {
  buildInsights,
  type Insight,
  type InsightForecast,
} from "@/lib/insights";

const LOOKBACK_DAYS = 7;

export interface InsightsResponse {
  insights: Insight[];
  windowDays: number;
}

export async function GET() {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const [transactions, agents, metrics] = await Promise.all([
    prisma.transaction.findMany({
      where: { createdAt: { gte: since }, reason: { not: null } },
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

  const forecasts = new Map<string, InsightForecast>();
  for (const [id, m] of metrics) {
    forecasts.set(id, {
      avgDaily: m.forecast.avgDaily,
      willExceedCap: m.forecast.willExceedCap,
      nearCap: m.forecast.nearCap,
    });
  }

  const insights = buildInsights({ transactions, agents, forecasts });

  const res: InsightsResponse = { insights, windowDays: LOOKBACK_DAYS };
  return NextResponse.json(res);
}
