import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAgentMetrics } from "@/lib/agentMetrics";
import type { AgentHealth } from "@/lib/health";

export interface TreeNode {
  id: string;
  name: string;
  expired: boolean;
  dailyCap: number;
  trustTier: string;
  trustScore: number;
  todayApprovedSpend: number;
  totalApprovedSpend: number;
  health: AgentHealth;
  counts: { approved: number; blocked: number; escalated: number };
  children: TreeNode[];
}

export interface TreeResponse {
  roots: TreeNode[];
}

export async function GET() {
  const agents = await prisma.agent.findMany({
    select: {
      id: true,
      name: true,
      parentAgentId: true,
      expiresAt: true,
      dailyCap: true,
      trustTier: true,
      trustScore: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const metrics = await getAgentMetrics();

  const now = Date.now();
  const nodes = new Map<string, TreeNode>();
  for (const agent of agents) {
    const m = metrics.get(agent.id);
    nodes.set(agent.id, {
      id: agent.id,
      name: agent.name,
      expired: agent.expiresAt.getTime() <= now,
      dailyCap: agent.dailyCap,
      trustTier: agent.trustTier,
      trustScore: agent.trustScore,
      todayApprovedSpend: m?.todayApprovedSpend ?? 0,
      totalApprovedSpend: m?.totalApprovedSpend ?? 0,
      health: m?.health ?? "healthy",
      counts: m?.counts ?? { approved: 0, blocked: 0, escalated: 0 },
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
