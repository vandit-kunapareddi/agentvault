import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseVendorInput, serializeVendors, splitVendors } from "@/lib/vendors";
import { parseVendorLimits, readVendorLimits } from "@/lib/vendorLimits";
import { signCredential } from "@/lib/credential";

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

interface PatchBody {
  name?: unknown;
  authorizedBy?: unknown;
  dailyCap?: unknown;
  perTxLimit?: unknown;
  approvedVendors?: unknown;
  vendorLimits?: unknown;
  expiresAt?: unknown;
}

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/agents/[id]">,
) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const existing = await prisma.agent.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  let name: string | undefined;
  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    name = body.name.trim();
  }

  let authorizedBy: string | undefined;
  if (body.authorizedBy !== undefined) {
    if (
      typeof body.authorizedBy !== "string" ||
      body.authorizedBy.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Authorized-by email is required" },
        { status: 400 },
      );
    }
    authorizedBy = body.authorizedBy.trim();
  }

  let dailyCap: number | undefined;
  if (body.dailyCap !== undefined) {
    const n = Number(body.dailyCap);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "Daily cap must be > 0" }, { status: 400 });
    }
    dailyCap = n;
  }

  let perTxLimit: number | undefined;
  if (body.perTxLimit !== undefined) {
    const n = Number(body.perTxLimit);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json(
        { error: "Per-transaction limit must be > 0" },
        { status: 400 },
      );
    }
    perTxLimit = n;
  }

  let vendors: string[] | undefined;
  if (body.approvedVendors !== undefined) {
    const raw =
      typeof body.approvedVendors === "string" ? body.approvedVendors : "";
    vendors = parseVendorInput(raw);
    if (vendors.length === 0) {
      return NextResponse.json(
        { error: "At least one approved vendor is required" },
        { status: 400 },
      );
    }
  }

  const vendorLimitsProvided = body.vendorLimits !== undefined;
  const parsedLimits = vendorLimitsProvided
    ? parseVendorLimits(body.vendorLimits)
    : undefined;

  let expiresAt: Date | undefined;
  if (body.expiresAt !== undefined) {
    if (typeof body.expiresAt !== "string") {
      return NextResponse.json(
        { error: "expiresAt must be an ISO string" },
        { status: 400 },
      );
    }
    const d = new Date(body.expiresAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json(
        { error: "Invalid expiresAt timestamp" },
        { status: 400 },
      );
    }
    expiresAt = d;
  }

  // Cross-field validation using the merged effective values.
  const effective = {
    name: name ?? existing.name,
    authorizedBy: authorizedBy ?? existing.authorizedBy,
    dailyCap: dailyCap ?? existing.dailyCap,
    perTxLimit: perTxLimit ?? existing.perTxLimit,
    approvedVendors: vendors ?? splitVendors(existing.approvedVendors),
    vendorLimits: vendorLimitsProvided
      ? parsedLimits
      : readVendorLimits(existing.vendorLimits),
    expiresAt: expiresAt ?? existing.expiresAt,
  };

  if (effective.perTxLimit > effective.dailyCap) {
    return NextResponse.json(
      { error: "Per-transaction limit cannot exceed daily cap" },
      { status: 400 },
    );
  }

  // Re-sign credential to match the new effective rules; if the agent is now
  // expired, clear the credential so it can't be used at all.
  const isExpired = effective.expiresAt.getTime() <= Date.now();
  const newCredential = isExpired
    ? null
    : signCredential({
        agentId: existing.id,
        agentName: effective.name,
        walletAddress: existing.walletAddress,
        authorizedBy: effective.authorizedBy,
        dailyCap: effective.dailyCap,
        perTxLimit: effective.perTxLimit,
        approvedVendors: effective.approvedVendors,
        vendorLimits: effective.vendorLimits ?? null,
        expiresAt: effective.expiresAt,
      });

  const data: Prisma.AgentUpdateInput = { credential: newCredential };
  if (name !== undefined) data.name = name;
  if (authorizedBy !== undefined) data.authorizedBy = authorizedBy;
  if (dailyCap !== undefined) data.dailyCap = dailyCap;
  if (perTxLimit !== undefined) data.perTxLimit = perTxLimit;
  if (vendors !== undefined) data.approvedVendors = serializeVendors(vendors);
  if (vendorLimitsProvided) {
    data.vendorLimits = parsedLimits ?? Prisma.DbNull;
  }
  if (expiresAt !== undefined) data.expiresAt = expiresAt;

  const updated = await prisma.agent.update({ where: { id }, data });
  return NextResponse.json({
    ...updated,
    approvedVendors: splitVendors(updated.approvedVendors),
  });
}
