import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode, DEMO_MESSAGE } from "@/lib/demo";
import { SimpleTrustProvider } from "@vanditk2/agentvault-trust";
import { prisma } from "@/lib/db";
import { signCredential } from "@/lib/credential";
import { parseVendorInput, serializeVendors, splitVendors } from "@/lib/vendors";
import { parseVendorLimits } from "@/lib/vendorLimits";
import { getAgentMetrics } from "@/lib/agentMetrics";

const trustProvider = new SimpleTrustProvider({
  minScore: Number(process.env.MIN_TRUST_SCORE) || 50,
});

function generateWalletAddress(): string {
  return `0x${randomBytes(20).toString("hex")}`;
}

export async function GET() {
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: "desc" },
  });
  const metrics = await getAgentMetrics();
  return NextResponse.json(
    agents.map((agent) => {
      const m = metrics.get(agent.id);
      return {
        ...agent,
        approvedVendors: splitVendors(agent.approvedVendors),
        health: m?.health ?? "healthy",
        transactionCount: m?.transactionCount ?? 0,
        forecast: m?.forecast,
      };
    }),
  );
}

interface CreateAgentBody {
  name?: unknown;
  authorizedBy?: unknown;
  dailyCap?: unknown;
  perTxLimit?: unknown;
  approvedVendors?: unknown;
  vendorLimits?: unknown;
  expiresAt?: unknown;
  parentAgentId?: unknown;
  walletAddress?: unknown;
}

export async function POST(req: NextRequest) {
  if (isDemoMode()) {
    return NextResponse.json({ error: DEMO_MESSAGE }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as CreateAgentBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const authorizedBy =
    typeof body.authorizedBy === "string" ? body.authorizedBy.trim() : "";
  const dailyCap = Number(body.dailyCap);
  const perTxLimit = Number(body.perTxLimit);
  const vendorsRaw = typeof body.approvedVendors === "string" ? body.approvedVendors : "";
  const vendors = parseVendorInput(vendorsRaw);
  const vendorLimits = parseVendorLimits(body.vendorLimits);
  const expiresAt =
    typeof body.expiresAt === "string" ? new Date(body.expiresAt) : new Date(NaN);
  const parentAgentId =
    typeof body.parentAgentId === "string" && body.parentAgentId.length > 0
      ? body.parentAgentId
      : null;
  const walletAddress =
    typeof body.walletAddress === "string" && body.walletAddress.trim().length > 0
      ? body.walletAddress.trim()
      : generateWalletAddress();

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!authorizedBy) {
    return NextResponse.json({ error: "Authorized-by email is required" }, { status: 400 });
  }
  if (!Number.isFinite(dailyCap) || dailyCap <= 0) {
    return NextResponse.json({ error: "Daily cap must be > 0" }, { status: 400 });
  }
  if (!Number.isFinite(perTxLimit) || perTxLimit <= 0) {
    return NextResponse.json({ error: "Per-transaction limit must be > 0" }, { status: 400 });
  }
  if (perTxLimit > dailyCap) {
    return NextResponse.json(
      { error: "Per-transaction limit cannot exceed daily cap" },
      { status: 400 },
    );
  }
  if (vendors.length === 0) {
    return NextResponse.json(
      { error: "At least one approved vendor is required" },
      { status: 400 },
    );
  }
  if (Number.isNaN(expiresAt.getTime())) {
    return NextResponse.json({ error: "Invalid expiresAt timestamp" }, { status: 400 });
  }
  if (expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "expiresAt must be in the future" }, { status: 400 });
  }

  const gate = await trustProvider.gate({
    walletAddress,
    known: true,
    active: true,
  });

  const created = await prisma.agent.create({
    data: {
      name,
      walletAddress,
      trustTier: gate.tier,
      trustScore: gate.score,
      authorizedBy,
      dailyCap,
      perTxLimit,
      approvedVendors: serializeVendors(vendors),
      vendorLimits: vendorLimits ?? undefined,
      expiresAt,
      parentAgentId: parentAgentId ?? undefined,
    },
  });

  const credential = signCredential({
    agentId: created.id,
    agentName: created.name,
    walletAddress: created.walletAddress,
    authorizedBy: created.authorizedBy,
    dailyCap: created.dailyCap,
    perTxLimit: created.perTxLimit,
    approvedVendors: vendors,
    vendorLimits,
    expiresAt: created.expiresAt,
  });

  const agent = await prisma.agent.update({
    where: { id: created.id },
    data: { credential },
  });

  return NextResponse.json(
    { ...agent, approvedVendors: splitVendors(agent.approvedVendors) },
    { status: 201 },
  );
}
