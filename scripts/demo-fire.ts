/**
 * Fires a single test payment against the live checkpoint. Designed for
 * demo recordings — one command per scenario.
 *
 *   npm run demo:fire approved      # green tx in the log
 *   npm run demo:fire over-limit    # red tx, blocked by per-tx limit
 *   npm run demo:fire escalate      # held tx — resolve in the dashboard
 *   npm run demo:fire vendor-limit  # blocked by per-vendor daily limit
 *   npm run demo:fire recognized    # ACP recognised (not settled)
 *
 * The script lazily registers a "Demo Test Agent" through the dashboard's
 * POST /api/agents endpoint (so the credential is signed with the same
 * JWT_SECRET the live checkpoint verifies with), primes it against the
 * vendors it will use during setup so subsequent payments don't trip the
 * "never-seen vendor" escalation, then fires the scenario payment.
 *
 * First run takes ~15s (registration + priming). Every later run is fast.
 *
 * Overridable for local testing:
 *   DASHBOARD_URL=http://localhost:3000 CHECKPOINT_URL=http://localhost:4000 \
 *     npm run demo:fire approved
 */

const DASHBOARD =
  process.env.DASHBOARD_URL ?? "https://agentvault-dashboard.vercel.app";
const CHECKPOINT =
  process.env.CHECKPOINT_URL ?? "https://agentvault-production.up.railway.app";

const DEMO_AGENT_NAME = "Demo Test Agent";
const PRIME_VENDORS = ["exa.ai", "openai.com"];

interface Scenario {
  vendor: string;
  amount: number;
  protocol?: "x402" | "mpp" | "acp";
  description: string;
}

const SCENARIOS: Record<string, Scenario> = {
  approved: {
    vendor: "exa.ai",
    amount: 0.03,
    description: "Approved — small payment to an approved vendor",
  },
  "over-limit": {
    vendor: "openai.com",
    amount: 50,
    description: "Blocked — amount over the per-transaction limit",
  },
  escalate: {
    vendor: "perplexity.ai",
    amount: 0.1,
    description:
      "Escalation — vendor not on approved list (resolve in the dashboard)",
  },
  "vendor-limit": {
    vendor: "exa.ai",
    amount: 1.5,
    description: "Blocked — would exceed the $1.00/day vendor limit on exa.ai",
  },
  recognized: {
    vendor: "openai.com",
    amount: 0.5,
    protocol: "acp",
    description: "ACP recognised (logged, not settled)",
  },
};

interface DemoAgent {
  id: string;
  name: string;
  credential: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function findExistingDemoAgent(): Promise<DemoAgent | null> {
  const list = (await fetch(`${DASHBOARD}/api/agents`, {
    headers: { accept: "application/json" },
  }).then((r) => r.json())) as Array<{
    id: string;
    name: string;
    credential: string | null;
  }>;
  const existing = list.find(
    (a) => a.name === DEMO_AGENT_NAME && typeof a.credential === "string",
  );
  if (!existing || !existing.credential) return null;
  return { id: existing.id, name: existing.name, credential: existing.credential };
}

async function registerDemoAgent(): Promise<DemoAgent> {
  const body = {
    name: DEMO_AGENT_NAME,
    authorizedBy: "demo@agentvault.dev",
    dailyCap: 100,
    perTxLimit: 25,
    approvedVendors:
      "exa.ai\nopenai.com\nhyperbolic.xyz\nfirecrawl.dev\ncoingecko.com",
    vendorLimits: { "exa.ai": 1.0 },
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };
  const res = await fetch(`${DASHBOARD}/api/agents`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      `Failed to register demo agent: ${err.error ?? `${res.status} ${res.statusText}`}`,
    );
  }
  return (await res.json()) as DemoAgent;
}

async function primeVendor(agent: DemoAgent, vendor: string): Promise<void> {
  // Fire a tiny payment to mark the vendor as "seen". It will escalate as
  // a first-payment-to-vendor; we resolve it as approved immediately so the
  // held call returns successfully.
  const firePromise = fetch(`${CHECKPOINT}/checkpoint`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      credential: agent.credential,
      vendor,
      amount: 0.01,
      protocol: "x402",
    }),
  }).then((r) => r.json());

  let escalationId: string | null = null;
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const escs = (await fetch(`${CHECKPOINT}/escalations?status=pending`).then(
      (r) => r.json(),
    )) as Array<{ id: string; agentId: string; vendor: string }>;
    const match = escs.find((e) => e.agentId === agent.id && e.vendor === vendor);
    if (match) {
      escalationId = match.id;
      break;
    }
  }

  if (escalationId) {
    await fetch(`${CHECKPOINT}/escalations/${escalationId}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        decision: "approved",
        resolvedBy: "demo:setup",
      }),
    });
  }
  await firePromise;
}

async function isVendorPrimed(agent: DemoAgent, vendor: string): Promise<boolean> {
  const txs = (await fetch(
    `${DASHBOARD}/api/transactions?agentId=${agent.id}&status=approved`,
    { headers: { accept: "application/json" } },
  ).then((r) => r.json())) as Array<{ vendor: string }>;
  return txs.some((t) => t.vendor === vendor);
}

async function ensureDemoAgent(): Promise<DemoAgent> {
  let agent = await findExistingDemoAgent();
  if (!agent) {
    console.log("Registering Demo Test Agent…");
    agent = await registerDemoAgent();
  }
  const toPrime: string[] = [];
  for (const vendor of PRIME_VENDORS) {
    if (!(await isVendorPrimed(agent, vendor))) toPrime.push(vendor);
  }
  if (toPrime.length > 0) {
    console.log(`Priming vendors: ${toPrime.join(", ")}…`);
    for (const vendor of toPrime) {
      await primeVendor(agent, vendor);
    }
    console.log("Setup complete.\n");
  }
  return agent;
}

function usageAndExit(code = 0): never {
  console.log("Usage: npm run demo:fire <scenario>\n");
  console.log("Scenarios:");
  for (const [name, s] of Object.entries(SCENARIOS)) {
    console.log(`  ${name.padEnd(13)} ${s.description}`);
  }
  process.exit(code);
}

async function main() {
  const name = process.argv[2];
  if (!name) usageAndExit(0);
  const scenario = SCENARIOS[name];
  if (!scenario) {
    console.error(`Unknown scenario: ${name}\n`);
    usageAndExit(1);
  }

  console.log(`Dashboard:  ${DASHBOARD}`);
  console.log(`Checkpoint: ${CHECKPOINT}`);
  console.log(`Scenario:   ${name} — ${scenario.description}\n`);

  const agent = await ensureDemoAgent();
  console.log(`Using agent: ${agent.name} (${agent.id})`);
  console.log(`Firing $${scenario.amount.toFixed(2)} to ${scenario.vendor}…`);

  const start = Date.now();
  const cpRes = await fetch(`${CHECKPOINT}/checkpoint`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      credential: agent.credential,
      vendor: scenario.vendor,
      amount: scenario.amount,
      protocol: scenario.protocol ?? "x402",
    }),
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const body = (await cpRes.json()) as {
    status?: string;
    protocol?: string;
    reason?: string;
    receipt?: { settled?: boolean };
  };

  console.log(`\nResult after ${elapsed}s:`);
  console.log(`  status:   ${body.status}`);
  if (body.protocol) console.log(`  protocol: ${body.protocol}`);
  if (body.receipt) console.log(`  settled:  ${body.receipt.settled}`);
  if (body.reason) console.log(`  reason:   ${body.reason}`);
}

main().catch((err) => {
  console.error("Demo fire failed:", err);
  process.exit(1);
});
