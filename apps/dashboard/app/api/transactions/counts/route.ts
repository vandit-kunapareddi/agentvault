import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export interface TransactionCounts {
  all: number;
  approved: number;
  blocked: number;
  escalated: number;
  recognized: number;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");

  const groups = await prisma.transaction.groupBy({
    by: ["status"],
    where: agentId ? { agentId } : {},
    _count: { _all: true },
  });

  const counts: TransactionCounts = {
    all: 0,
    approved: 0,
    blocked: 0,
    escalated: 0,
    recognized: 0,
  };
  for (const g of groups) {
    const n = g._count._all;
    counts.all += n;
    if (g.status in counts) {
      (counts as unknown as Record<string, number>)[g.status] = n;
    }
  }
  return NextResponse.json(counts);
}
