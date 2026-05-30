import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../.env") });

const prisma = new PrismaClient();

const DAY = 86_400_000;
const MIN = 60_000;
const HOUR = 3_600_000;

const NOW = Date.now();
const TODAY_START_UTC = (() => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
})();

const VENDORS = [
  "exa.ai",
  "hyperbolic.xyz",
  "firecrawl.dev",
  "coingecko.com",
  "openai.com",
] as const;
type Vendor = (typeof VENDORS)[number];

const VENDOR_RANGE: Record<Vendor, [number, number]> = {
  "exa.ai": [0.005, 0.05],
  "hyperbolic.xyz": [0.1, 2.5],
  "firecrawl.dev": [0.002, 0.03],
  "coingecko.com": [0.0008, 0.01],
  "openai.com": [0.01, 0.85],
};
const APPROVED_VENDORS = VENDORS.join(",");

interface SeedAgent {
  id: string;
  name: string;
  parentAgentId: string | null;
  dailyCap: number;
  perTxLimit: number;
  trustTier: string;
  trustScore: number;
  wallet: string;
  vendorLimits?: Record<string, number>;
}

const SEED_AGENTS: SeedAgent[] = [
  {
    id: "seed-orchestrator",
    name: "Orchestrator Agent",
    parentAgentId: null,
    dailyCap: 50,
    perTxLimit: 10,
    trustTier: "verified",
    trustScore: 92,
    wallet: "0x" + "a1".repeat(20),
  },
  {
    id: "seed-research",
    name: "Research Agent",
    parentAgentId: "seed-orchestrator",
    dailyCap: 20,
    perTxLimit: 5,
    trustTier: "verified",
    trustScore: 85,
    wallet: "0x" + "b2".repeat(20),
    vendorLimits: { "exa.ai": 1.0, "firecrawl.dev": 3.0 },
  },
  {
    id: "seed-compute",
    name: "Compute Agent",
    parentAgentId: "seed-orchestrator",
    dailyCap: 30,
    perTxLimit: 8,
    trustTier: "verified",
    trustScore: 88,
    wallet: "0x" + "c3".repeat(20),
    vendorLimits: { "hyperbolic.xyz": 2.0 },
  },
  {
    id: "seed-shopping",
    name: "Shopping Agent",
    parentAgentId: "seed-orchestrator",
    dailyCap: 15,
    perTxLimit: 4,
    trustTier: "probation",
    trustScore: 64,
    wallet: "0x" + "d4".repeat(20),
  },
];
const SEED_IDS = SEED_AGENTS.map((a) => a.id);
const AGENT_BY_ID = new Map(SEED_AGENTS.map((a) => [a.id, a]));

function mulberry32(seed: number) {
  let s = seed >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(1337);
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}
function rand(min: number, max: number): number {
  return min + rng() * (max - min);
}
function round(n: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

const SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me";
const AUTHORIZED_BY = "cl@shivamsinghal.me";

function makeCredential(a: SeedAgent, expiresAt: Date): string {
  const nowSec = Math.floor(NOW / 1000);
  const expSec = Math.floor(expiresAt.getTime() / 1000);
  const payload: Record<string, unknown> = {
    agentId: a.id,
    agentName: a.name,
    walletAddress: a.wallet,
    authorizedBy: AUTHORIZED_BY,
    dailyCap: a.dailyCap,
    perTxLimit: a.perTxLimit,
    approvedVendors: [...VENDORS],
    supportedProtocols: ["x402", "mpp", "acp"],
    issuedAt: nowSec,
    expiresAt: expSec,
  };
  if (a.vendorLimits && Object.keys(a.vendorLimits).length > 0) {
    payload.vendorLimits = a.vendorLimits;
  }
  return jwt.sign(payload, SECRET, { expiresIn: expSec - nowSec });
}

interface TxInsert {
  agentId: string;
  vendor: string;
  amount: number;
  status: string;
  protocol: string;
  trustTier: string | null;
  reason: string | null;
  createdAt: Date;
}

function dbHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").host;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}

async function clearSeedData(): Promise<void> {
  const oldTx = await prisma.transaction.findMany({
    where: { agentId: { in: SEED_IDS } },
    select: { id: true },
  });
  if (oldTx.length > 0) {
    await prisma.escalation.deleteMany({
      where: { transactionId: { in: oldTx.map((t) => t.id) } },
    });
    await prisma.transaction.deleteMany({
      where: { agentId: { in: SEED_IDS } },
    });
  }
  await prisma.agent.deleteMany({ where: { id: { in: SEED_IDS } } });
}

async function insertAgents(): Promise<void> {
  const expiresAt = new Date(NOW + 90 * DAY);
  for (const a of SEED_AGENTS) {
    await prisma.agent.create({
      data: {
        id: a.id,
        name: a.name,
        walletAddress: a.wallet,
        trustTier: a.trustTier,
        trustScore: a.trustScore,
        parentAgentId: a.parentAgentId ?? undefined,
        authorizedBy: AUTHORIZED_BY,
        dailyCap: a.dailyCap,
        perTxLimit: a.perTxLimit,
        approvedVendors: APPROVED_VENDORS,
        vendorLimits: a.vendorLimits ?? undefined,
        expiresAt,
        credential: makeCredential(a, expiresAt),
      },
    });
  }
}

function pushApproved(
  out: TxInsert[],
  agentId: string,
  vendor: string,
  amount: number,
  createdAt: Date,
  protocol: string = "x402",
): void {
  const a = AGENT_BY_ID.get(agentId)!;
  out.push({
    agentId,
    vendor,
    amount,
    status: "approved",
    protocol,
    trustTier: a.trustTier,
    reason: null,
    createdAt,
  });
}

function buildHistoricalApproved(): TxInsert[] {
  const out: TxInsert[] = [];
  // distinct day-to-day counts so the daily-spend chart looks lived-in
  const perDayCounts: Record<number, number> = {
    6: 3,
    5: 6,
    4: 2,
    3: 7,
    2: 4,
    1: 5,
  };
  for (const daysAgo of [6, 5, 4, 3, 2, 1]) {
    const dayStart = TODAY_START_UTC - daysAgo * DAY;
    for (let i = 0; i < perDayCounts[daysAgo]!; i++) {
      const agent = pick(SEED_AGENTS);
      const vendor = pick(VENDORS);
      const [lo, hi] = VENDOR_RANGE[vendor];
      const dp = vendor === "coingecko.com" ? 4 : 3;
      let amount = round(rand(lo, hi), dp);
      if (amount > agent.perTxLimit) amount = agent.perTxLimit;
      const protocol = rng() < 0.82 ? "x402" : "mpp";
      const hour = 8 + Math.floor(rng() * 14); // 08:00–21:59 UTC
      const minute = Math.floor(rng() * 60);
      const createdAt = new Date(dayStart + hour * HOUR + minute * MIN);
      pushApproved(out, agent.id, vendor, amount, createdAt, protocol);
    }
  }
  return out;
}

function buildTodayApproved(): TxInsert[] {
  const out: TxInsert[] = [];
  const minAgo = (m: number) => new Date(NOW - m * MIN);

  // Orchestrator (healthy): modest spend today, well under cap 50
  pushApproved(out, "seed-orchestrator", "hyperbolic.xyz", 2.45, minAgo(180));
  pushApproved(out, "seed-orchestrator", "openai.com", 3.1, minAgo(95));

  // Research (small approved spend today; warning state comes from escalations)
  pushApproved(out, "seed-research", "exa.ai", 0.04, minAgo(150));
  pushApproved(out, "seed-research", "coingecko.com", 0.006, minAgo(70));

  // Compute (a couple approved today; critical state comes from recent blocked)
  // Hyperbolic kept under the $2.00 per-vendor limit so the limit visualises
  // as nearly-full on the agent detail page.
  pushApproved(out, "seed-compute", "hyperbolic.xyz", 1.5, minAgo(200));
  pushApproved(out, "seed-compute", "firecrawl.dev", 0.02, minAgo(130));

  // Shopping (warning: ~88% of $15 daily cap today)
  pushApproved(out, "seed-shopping", "openai.com", 3.8, minAgo(220));
  pushApproved(out, "seed-shopping", "hyperbolic.xyz", 3.6, minAgo(170));
  pushApproved(out, "seed-shopping", "openai.com", 3.1, minAgo(110));
  pushApproved(out, "seed-shopping", "hyperbolic.xyz", 2.7, minAgo(40));

  return out;
}

function buildBlocked(): TxInsert[] {
  const out: TxInsert[] = [];

  // Recent — drives Compute to "critical" via blockedLast10Min > 0
  out.push({
    agentId: "seed-compute",
    vendor: "hyperbolic.xyz",
    amount: 9.0,
    status: "blocked",
    protocol: "x402",
    trustTier: "verified",
    reason: "Amount $9.00 exceeds per-transaction limit $8.00",
    createdAt: new Date(NOW - 4 * MIN),
  });

  // Historical blocked transactions, spread across the past week
  out.push({
    agentId: "seed-shopping",
    vendor: "openai.com",
    amount: 5.0,
    status: "blocked",
    protocol: "x402",
    trustTier: "probation",
    reason: "Amount $5.00 exceeds per-transaction limit $4.00",
    createdAt: new Date(TODAY_START_UTC - 2 * DAY + 14 * HOUR),
  });
  out.push({
    agentId: "seed-research",
    vendor: "hyperbolic.xyz",
    amount: 2.4,
    status: "blocked",
    protocol: "x402",
    trustTier: "verified",
    reason: "Would exceed daily cap (spent $18.90 + $2.40 > $20.00)",
    createdAt: new Date(TODAY_START_UTC - 3 * DAY + 17 * HOUR),
  });
  out.push({
    agentId: "seed-orchestrator",
    vendor: "scraperapi.com",
    amount: 0.5,
    status: "blocked",
    protocol: "x402",
    trustTier: "verified",
    reason: 'Vendor "scraperapi.com" is not on the approved list',
    createdAt: new Date(TODAY_START_UTC - 1 * DAY + 11 * HOUR),
  });

  // Per-vendor limit blocks — surface the new check in the transaction log.
  out.push({
    agentId: "seed-compute",
    vendor: "hyperbolic.xyz",
    amount: 0.8,
    status: "blocked",
    protocol: "x402",
    trustTier: "verified",
    reason:
      "Vendor limit reached: $1.50 of $2.00 daily limit used for hyperbolic.xyz",
    createdAt: new Date(NOW - 30 * MIN),
  });
  out.push({
    agentId: "seed-research",
    vendor: "exa.ai",
    amount: 1.2,
    status: "blocked",
    protocol: "x402",
    trustTier: "verified",
    reason:
      "Vendor limit reached: $0.04 of $1.00 daily limit used for exa.ai",
    createdAt: new Date(NOW - 50 * MIN),
  });

  return out;
}

function buildRecognized(): TxInsert[] {
  return [
    {
      agentId: "seed-shopping",
      vendor: "openai.com",
      amount: 1.2,
      status: "recognized",
      protocol: "acp",
      trustTier: "probation",
      reason:
        'Protocol "acp" recognized; execution is not yet implemented (not settled)',
      createdAt: new Date(TODAY_START_UTC - 1 * DAY + 12 * HOUR),
    },
  ];
}

async function createResolvedEscalations(): Promise<void> {
  // Esc A: approved after review — drives Research toward "warning"
  const txA = await prisma.transaction.create({
    data: {
      agentId: "seed-research",
      vendor: "firecrawl.dev",
      amount: 2.1,
      status: "approved",
      protocol: "x402",
      trustTier: "verified",
      reason:
        'Approved after review — First payment to "firecrawl.dev" — vendor is approved but this agent has never paid it before',
      createdAt: new Date(NOW - 25 * MIN),
    },
  });
  await prisma.escalation.create({
    data: {
      transactionId: txA.id,
      status: "approved",
      notifiedAt: new Date(NOW - 25 * MIN),
      resolvedAt: new Date(NOW - 24 * MIN),
      resolvedBy: AUTHORIZED_BY,
      createdAt: new Date(NOW - 25 * MIN),
    },
  });

  // Esc B: blocked by reviewer
  const txB = await prisma.transaction.create({
    data: {
      agentId: "seed-research",
      vendor: "hyperbolic.xyz",
      amount: 4.5,
      status: "blocked",
      protocol: "x402",
      trustTier: "verified",
      reason:
        "Blocked by reviewer — Near daily cap: this would bring spend to $19.50 of $20.00",
      createdAt: new Date(NOW - 42 * MIN),
    },
  });
  await prisma.escalation.create({
    data: {
      transactionId: txB.id,
      status: "blocked",
      notifiedAt: new Date(NOW - 42 * MIN),
      resolvedAt: new Date(NOW - 41 * MIN),
      resolvedBy: "slack:vandit.kunapareddi",
      createdAt: new Date(NOW - 42 * MIN),
    },
  });
}

function summarize(rows: TxInsert[]): void {
  const byStatus = new Map<string, number>();
  for (const r of rows) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
  const parts = [...byStatus.entries()].map(([k, v]) => `${k}=${v}`);
  console.log(`  Bulk transactions: ${rows.length} (${parts.join(", ")})`);
}

async function main() {
  console.log(`Seeding DB host: ${dbHost()}`);

  console.log("Clearing existing seed agents (by id prefix 'seed-')…");
  await clearSeedData();

  console.log("Creating 4 seed agents…");
  await insertAgents();

  const rows = [
    ...buildHistoricalApproved(),
    ...buildTodayApproved(),
    ...buildBlocked(),
    ...buildRecognized(),
  ];
  summarize(rows);
  await prisma.transaction.createMany({ data: rows });

  console.log("Creating 2 resolved escalations (Research Agent)…");
  await createResolvedEscalations();

  console.log("Seed complete.");
  console.log(
    "Expected agent health → Orchestrator: healthy · Research: warning · Compute: critical · Shopping: warning",
  );
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
