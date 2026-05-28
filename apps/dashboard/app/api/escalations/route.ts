import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

const DEFAULT_TIMEOUT_MS = 60_000;

function getTimeoutMs(): number {
  const raw = Number(process.env.ESCALATION_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limitParam = url.searchParams.get("limit");
  const limit = (() => {
    if (!limitParam) return 100;
    const n = Number(limitParam);
    if (!Number.isFinite(n) || n <= 0) return 100;
    return Math.min(Math.floor(n), 500);
  })();

  const rows = await prisma.escalation.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { transaction: { include: { agent: true } } },
  });

  const timeoutMs = getTimeoutMs();
  return NextResponse.json(
    rows.map((row) => {
      const created = row.createdAt;
      return {
        id: row.id,
        transactionId: row.transactionId,
        agentId: row.transaction.agentId,
        agentName: row.transaction.agent.name,
        vendor: row.transaction.vendor,
        amount: row.transaction.amount,
        reason: row.transaction.reason,
        status: row.status,
        notifiedAt: row.notifiedAt?.toISOString() ?? null,
        resolvedAt: row.resolvedAt?.toISOString() ?? null,
        resolvedBy: row.resolvedBy,
        createdAt: created.toISOString(),
        deadlineAt:
          row.status === "pending"
            ? new Date(created.getTime() + timeoutMs).toISOString()
            : null,
      };
    }),
  );
}
