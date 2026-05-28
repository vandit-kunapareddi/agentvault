import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { isCheckpointStatus } from "@/lib/status";

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get("agentId");
  const statusParam = url.searchParams.get("status");
  const limitParam = url.searchParams.get("limit");

  const status =
    statusParam && isCheckpointStatus(statusParam) ? statusParam : undefined;

  let limit = DEFAULT_LIMIT;
  if (limitParam) {
    const parsed = Number(limitParam);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(Math.floor(parsed), MAX_LIMIT);
    }
  }

  const rows = await prisma.transaction.findMany({
    where: {
      ...(agentId ? { agentId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { agent: { select: { name: true } } },
  });

  return NextResponse.json(
    rows.map((row) => ({
      id: row.id,
      agentId: row.agentId,
      agentName: row.agent.name,
      vendor: row.vendor,
      amount: row.amount,
      status: row.status,
      protocol: row.protocol,
      trustTier: row.trustTier,
      reason: row.reason,
      createdAt: row.createdAt.toISOString(),
    })),
  );
}
