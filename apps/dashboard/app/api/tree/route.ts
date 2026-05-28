import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export interface TreeNode {
  id: string;
  name: string;
  expired: boolean;
  dailyCap: number;
  totalApprovedSpend: number;
  counts: { approved: number; blocked: number; escalated: number };
  children: TreeNode[];
}

export interface TreeResponse {
  roots: TreeNode[];
}

export async function GET() {
  const agents = await prisma.agent.findMany({
    include: {
      transactions: { select: { status: true, amount: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = Date.now();

  const nodes = new Map<string, TreeNode>();
  for (const agent of agents) {
    const counts = { approved: 0, blocked: 0, escalated: 0 };
    let totalApprovedSpend = 0;
    for (const tx of agent.transactions) {
      if (tx.status === "approved") {
        counts.approved += 1;
        totalApprovedSpend += tx.amount;
      } else if (tx.status === "blocked") {
        counts.blocked += 1;
      } else if (tx.status === "escalated") {
        counts.escalated += 1;
      }
    }
    nodes.set(agent.id, {
      id: agent.id,
      name: agent.name,
      expired: agent.expiresAt.getTime() <= now,
      dailyCap: agent.dailyCap,
      totalApprovedSpend,
      counts,
      children: [],
    });
  }

  const roots: TreeNode[] = [];
  for (const agent of agents) {
    const node = nodes.get(agent.id)!;
    if (agent.parentAgentId && nodes.has(agent.parentAgentId)) {
      nodes.get(agent.parentAgentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const response: TreeResponse = { roots };
  return NextResponse.json(response);
}
