import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { splitVendors } from "@/lib/vendors";

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/agents/[id]">,
) {
  const { id } = await ctx.params;
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...agent,
    approvedVendors: splitVendors(agent.approvedVendors),
  });
}
