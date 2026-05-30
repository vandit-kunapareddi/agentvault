import { prisma } from "./db.js";

export async function getTodaysApprovedSpend(agentId: string): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const rows = await prisma.transaction.findMany({
    where: {
      agentId,
      status: "approved",
      createdAt: { gte: start },
    },
    select: { amount: true },
  });
  return rows.reduce((sum, row) => sum + row.amount, 0);
}

export async function getTodaysApprovedSpendForVendor(
  agentId: string,
  vendor: string,
): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const rows = await prisma.transaction.findMany({
    where: {
      agentId,
      vendor,
      status: "approved",
      createdAt: { gte: start },
    },
    select: { amount: true },
  });
  return rows.reduce((sum, row) => sum + row.amount, 0);
}
