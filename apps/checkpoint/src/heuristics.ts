import { prisma } from "./db.js";

const RECENT_WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_RATE_LIMIT = 3;

export function getEscalationRateLimit(): number {
  const raw = Number(process.env.ESCALATION_RATE_LIMIT);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_RATE_LIMIT;
}

export async function hasUsedVendorBefore(
  agentId: string,
  vendor: string,
): Promise<boolean> {
  const prior = await prisma.transaction.findFirst({
    where: { agentId, vendor, status: "approved" },
    select: { id: true },
  });
  return prior !== null;
}

export async function countRecentEscalations(agentId: string): Promise<number> {
  const since = new Date(Date.now() - RECENT_WINDOW_MS);
  return prisma.escalation.count({
    where: {
      createdAt: { gte: since },
      transaction: { agentId },
    },
  });
}
