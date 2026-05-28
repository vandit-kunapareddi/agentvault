import { NextResponse, type NextRequest } from "next/server";
import type { ResolveEscalationRequest } from "@agentvault/types";

const CHECKPOINT_URL =
  process.env.CHECKPOINT_INTERNAL_URL ?? "http://localhost:4000";

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/escalations/[id]/resolve">,
) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as
    | Partial<ResolveEscalationRequest>
    | null;

  if (!body || (body.decision !== "approved" && body.decision !== "blocked")) {
    return NextResponse.json(
      { error: "decision must be 'approved' or 'blocked'" },
      { status: 400 },
    );
  }

  const payload: ResolveEscalationRequest = {
    decision: body.decision,
    resolvedBy:
      typeof body.resolvedBy === "string" && body.resolvedBy.length > 0
        ? body.resolvedBy
        : "dashboard",
  };

  try {
    const upstream = await fetch(
      `${CHECKPOINT_URL}/escalations/${encodeURIComponent(id)}/resolve`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const text = await upstream.text();
    return new NextResponse(text, {
      status: upstream.status,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[dashboard] failed to forward to checkpoint", err);
    return NextResponse.json(
      { error: "Checkpoint service unreachable" },
      { status: 502 },
    );
  }
}
