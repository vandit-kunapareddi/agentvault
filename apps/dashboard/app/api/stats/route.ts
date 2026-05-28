import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const DAYS = 14;

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (DAYS - 1));

  const approved = await prisma.transaction.findMany({
    where: { status: "approved", createdAt: { gte: start } },
    select: { amount: true, createdAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    buckets.set(dayKey(d), 0);
  }
  for (const tx of approved) {
    const key = dayKey(tx.createdAt);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + tx.amount);
  }
  const dailySpend = Array.from(buckets.entries()).map(([date, amount]) => ({
    date,
    amount: Number(amount.toFixed(2)),
  }));

  const grouped = await prisma.transaction.groupBy({
    by: ["agentId"],
    where: { status: "approved" },
    _sum: { amount: true },
  });
  const agents = await prisma.agent.findMany({ select: { id: true, name: true } });
  const nameById = new Map(agents.map((a) => [a.id, a.name]));
  const perAgentSpend = grouped
    .map((g) => ({
      agentName: nameById.get(g.agentId) ?? g.agentId.slice(0, 8),
      amount: Number((g._sum.amount ?? 0).toFixed(2)),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  return NextResponse.json({ dailySpend, perAgentSpend });
}
