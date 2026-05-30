import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildInsights, type Insight } from "@/lib/insights";

const LOOKBACK_DAYS = 7;

export interface InsightsResponse {
  insights: Insight[];
  windowDays: number;
}

export async function GET() {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  const [transactions, agents] = await Promise.all([
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
  ]);

  const insights = buildInsights({ transactions, agents });

  const res: InsightsResponse = { insights, windowDays: LOOKBACK_DAYS };
  return NextResponse.json(res);
}
