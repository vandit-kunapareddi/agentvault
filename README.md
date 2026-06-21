# AgentVault

**One SDK. Any agentic payment protocol. Full control.**

AgentVault is an open-source trust and control layer for autonomous AI-agent payments. You drop one SDK into your agent and it can pay services across multiple agentic payment protocols, with credential-based budget enforcement, cross-agent spend visibility, and human-in-the-loop escalation enforced by an external checkpoint — not inside the agent's own code.

> **Status: open source · self-host today.**
> There is no hosted version yet. To use AgentVault you clone this repo and run your own checkpoint, dashboard, and Postgres. A hosted multi-tenant version is on the roadmap; see [Roadmap](#roadmap).

---

## What works today, and what doesn't

Being honest about the current state so you know what you're getting:

| Capability | State |
|---|---|
| Checkpoint decision pipeline (verify credential → trust gate → per-tx → vendor whitelist → per-vendor limit → daily cap → near-cap escalation → never-seen-vendor escalation → escalation-rate-limit) | **Works end-to-end** |
| Human-in-the-loop escalation (60s hold, Slack notification, Approve/Block buttons, auto-block on timeout) | **Works end-to-end**, including HMAC-verified Slack callbacks |
| Dashboard (spending tree, live transaction log, escalation queue, charts, KPIs, suggestions, forecasts, light/dark) | **Works end-to-end** |
| `x402` protocol handler | **Real EIP-3009 USDC settlement on Base Sepolia testnet** when `WALLET_PRIVATE_KEY` is set; falls back to mock receipts when unset |
| `MPP` protocol handler | **Basic one-shot only.** Sessions, streaming micropayments, subscriptions, and reconciliation are not implemented |
| `ACP` protocol handler | **Detected and logged** with `settled: false` / status `recognized`. Full checkout execution (Shared Payment Token, cart, fulfillment) is not implemented |
| `TrustProvider` interface + `SimpleTrustProvider` | **Works** as the default. The interface is vendor-neutral, so external providers can be added behind it without touching the pipeline |
| `@vanditk2/agentvault-sdk` on npm | **Published — v0.1.0.** `npm install @vanditk2/agentvault-sdk` |
| Hosted multi-tenant SaaS | **Not built.** Each user runs their own deployment with their own JWT secret and wallet |

If any of those gaps are blockers for you, please open an issue — they're all on the roadmap.

---

## Why

When you give an agent the ability to spend money, three gaps appear that none of the underlying payment protocols address:

- **Limits live inside the agent.** If the agent misbehaves or is compromised, the limits go with it. Enforcement needs to be external.
- **Sub-agents are a black box.** Agents hire other agents, which spend too. You only see your top-level agent — everything downstream is invisible.
- **No safety net.** Every protocol is built for full autonomy. There's no mechanism to pause a payment and ask "did you mean to do this?" before it executes.

AgentVault closes all three: an independent checkpoint enforces rules outside the agent, a live spending tree shows the full agent hierarchy, and unusual payments are paused for human approval.

---

## How it works

```
   ┌──────────┐
   │  Agent   │  vault.pay({ endpoint, maxAmount })
   │  (SDK)   │
   └────┬─────┘
        │  1. detect protocol from the endpoint
        ▼
   ┌─────────────────────────────────────────────┐
   │             Checkpoint (Express)            │
   │                                             │
   │  2. verify signed credential (JWT)          │
   │  3. trust gate (pluggable TrustProvider)    │
   │  4. per-transaction limit                   │
   │  5. vendor whitelist          → escalate    │
   │  6. per-vendor daily limit                  │
   │  7. daily budget cap                        │
   │  8. near-cap warning          → escalate    │
   │  9. never-seen vendor         → escalate    │
   │ 10. escalation rate-limit     → escalate    │
   │ 11. route → protocol handler → receipt      │
   │                                             │
   │   ┌────────┐  ┌────────┐  ┌────────┐        │
   │   │  x402  │  │  MPP   │  │  ACP   │ (+more)│
   │   └────────┘  └────────┘  └────────┘        │
   └───────┬─────────────────────────┬───────────┘
           │ writes Transaction rows │ on escalate
           ▼                         ▼
     ┌──────────┐             ┌───────────────┐
     │ Postgres │             │ Slack + queue │
     │ (Prisma) │             │  (approve /   │
     └────┬─────┘             │    block)     │
          │                   └───────────────┘
          ▼
    ┌─────────────┐
    │  Dashboard  │  spending tree · live log · escalation queue
    │  (Next.js)  │  · suggestions · forecasts
    └─────────────┘
```

Each step short-circuits the pipeline:

1. **Credential** — verify the JWT signature → tampered → **block**
2. **Expiry** — credential expired → **block**
3. **Trust gate** — agent's trust score below `MIN_TRUST_SCORE` → **block**
4. **Per-transaction limit** — amount over `perTxLimit` → **block**
5. **Vendor whitelist** — vendor not in `approvedVendors` → **escalate**
6. **Per-vendor daily limit** — today's spend with this vendor + amount over the per-vendor cap → **block**
7. **Daily budget** — today's total + amount over `dailyCap` → **block**
8. **Near-cap** — projected spend ≥ 90% of daily cap → **escalate**
9. **Never-seen vendor** — first-ever payment to an approved vendor → **escalate**
10. **Escalation rate limit** — agent has triggered more than `ESCALATION_RATE_LIMIT` escalations in the last hour → **escalate**
11. **Route** — approved payments dispatch to the matching protocol handler and return a settlement receipt

An escalated payment is **held** for `ESCALATION_TIMEOUT_MS` (default 60s) while a human decides (Slack or dashboard). If no decision arrives in time it **auto-blocks** — it never fails open.

---

## Self-host quickstart

You'll need:

- Node 20+ and npm 9+
- A Postgres database (local Docker or hosted)
- A long random string for `JWT_SECRET`

### 1. Clone and install

```bash
git clone https://github.com/vandit-kunapareddi/agentvault
cd agentvault
npm install
```

### 2. Bring up a local Postgres

Easiest with Docker:

```bash
docker compose up -d
```

`docker-compose.yml` ships a Postgres 16 instance on port 5432 with database/user/password all set to `agentvault`.

### 3. Configure environment

```bash
cp .env.example .env
```

Then edit `.env`:

- `DATABASE_URL` — already set to `postgresql://agentvault:agentvault@localhost:5432/agentvault?schema=public` for the Docker setup
- `JWT_SECRET` — replace `dev-secret-change-me` with a long random string. Generate one with `openssl rand -hex 32`

### 4. Apply database migrations

```bash
npm run db:migrate:deploy
npm run db:generate
```

### 5. (Optional) Seed demo data

```bash
npm run seed
```

This creates four hierarchical agents (Orchestrator → Research / Compute / Shopping) with ~40 transactions spread across the last week, so the dashboard isn't empty on first launch.

### 6. Run dev

```bash
npm run dev
```

Checkpoint on `:4000`, dashboard on `:3000`. Open `http://localhost:3000`.

### 7. (Optional) Enable real x402 settlement

By default the x402 handler returns mock receipts. To do real on-chain settlement on Base Sepolia testnet:

```bash
npm run wallet:bootstrap
```

Save the printed private key, fund the address at the [Coinbase Base Sepolia faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet) (ETH for gas) and the [Circle USDC faucet](https://faucet.circle.com) (select Base Sepolia), then add `WALLET_PRIVATE_KEY=0x...` to `.env`. Restart the checkpoint and x402 calls will sign and settle real EIP-3009 USDC transfers via `@x402/axios` + `@x402/evm` + `viem`.

### Deploying

The simplest deploy uses Vercel for the dashboard and Railway for the checkpoint + Postgres:

- **Checkpoint → Railway.** Connect the GitHub repo, add the Postgres plugin, set env vars (`DATABASE_URL`, `JWT_SECRET`, `MIN_TRUST_SCORE`, `ESCALATION_TIMEOUT_MS`, `ESCALATION_RATE_LIMIT`, `SLACK_WEBHOOK_URL`, `SLACK_SIGNING_SECRET`, `DASHBOARD_URL`, optional `WALLET_PRIVATE_KEY`). `railway.json` handles build, migrations, and start.
- **Dashboard → Vercel.** Import the repo with **Root Directory = `apps/dashboard`**. Set env vars (`DATABASE_URL` pointing at Railway's public Postgres URL, the same `JWT_SECRET` as Railway, `CHECKPOINT_INTERNAL_URL` pointing at the Railway service, `DASHBOARD_URL` pointing at the Vercel URL).

The Vercel `DATABASE_URL` and the Railway `JWT_SECRET` **must match** their checkpoint counterparts — the dashboard signs credentials, the checkpoint verifies them.

---

## Spending credential

Each agent gets a signed JWT that travels with it. Rules live in the credential, not in the agent's own code:

```json
{
  "agentId": "clx123abc",
  "agentName": "Research Agent",
  "walletAddress": "0x52ce…",
  "authorizedBy": "developer@example.com",
  "dailyCap": 10.0,
  "perTxLimit": 0.5,
  "approvedVendors": ["exa.ai", "hyperbolic.xyz"],
  "vendorLimits": { "exa.ai": 2.0, "hyperbolic.xyz": 3.0 },
  "supportedProtocols": ["x402", "mpp", "acp"],
  "issuedAt": 1748390400,
  "expiresAt": 1748476800
}
```

Per-vendor `vendorLimits` are applied **on top of** the global `dailyCap`. A payment is blocked if either is exceeded.

---

## SDK usage

Install:

```bash
npm install @vanditk2/agentvault-sdk
```

The SDK is useless on its own — it talks to an AgentVault checkpoint. Until a hosted version exists, that means self-hosting this repo first (see the quickstart above) and pointing `checkpointUrl` at your deployment.

```ts
import { AgentVault } from "@vanditk2/agentvault-sdk";

const vault = new AgentVault({
  credential: process.env.AGENT_CREDENTIAL!, // the signed JWT issued by your dashboard
  checkpointUrl: "http://localhost:4000",
});

// The agent never has to know which protocol the service speaks.
const result = await vault.pay({
  endpoint: "https://api.someservice.com/data",
  maxAmount: 0.05,
});

if (result.status === "approved") {
  // result.protocol, result.receipt, result.trustTier
}
```

`pay()` probes the endpoint to detect the protocol, then routes the request through your checkpoint, which verifies trust, enforces budget rules, escalates if needed, and dispatches to the right protocol handler.

---

## Extending AgentVault

Two extension points keep the rest of the checkpoint untouched.

**Protocol handlers** — add a new agentic payment protocol (e.g. AP2, TAP, Lightning) or replace a built-in mock with a real implementation. The router is a string-keyed registry; built-in handlers self-register at module load, external code calls `registerHandler("ap2", myHandler)` and the checkpoint routes to it without any pipeline changes.

```ts
import type { ProtocolHandler } from "./router.js";
import { registerHandler } from "./router.js";

const lightningHandler: ProtocolHandler = async ({ vendor, amount, endpoint }) => {
  // … execute the payment, return a PaymentReceipt
};

registerHandler("bitcoin-lightning", lightningHandler);
```

**Trust providers** — swap `SimpleTrustProvider` for a custom one (on-chain reputation, behavioural model, in-house service) by implementing the small `TrustProvider` interface and changing one line in [`apps/checkpoint/src/trust.ts`](./apps/checkpoint/src/trust.ts).

```ts
interface TrustProvider {
  gate(ctx: AgentTrustContext): Promise<GateResult>; // { tier, score, allow }
}
```

Full guide with worked examples, error semantics, and gotchas: **[docs/EXTENDING.md](./docs/EXTENDING.md)**.

Two runnable reference implementations live in [`examples/`](./examples/) — a custom [`TrustProvider`](./examples/custom-trust-provider/) and a custom [protocol handler](./examples/custom-protocol-handler/). Both are workspace packages with their own unit tests, so they can't silently drift from the interfaces they document.

**Webhooks** — subscribe an external system to checkpoint events (`transaction.approved`, `transaction.blocked`, escalation lifecycle, etc.). Each delivery is HMAC-signed; subscribers verify with the same pattern as Slack. Manage subscriptions from the dashboard's **Webhooks** page. Full event catalog + signature verification example: **[docs/WEBHOOKS.md](./docs/WEBHOOKS.md)**.

---

## Configuration

All configuration is via `.env` (see `.env.example`):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_SECRET` | Signs and verifies spending credentials. **Must match** between dashboard and checkpoint |
| `MIN_TRUST_SCORE` | Minimum trust score (0–100) an agent must clear to transact |
| `ESCALATION_TIMEOUT_MS` | How long a held payment waits before auto-blocking (default 60000) |
| `ESCALATION_RATE_LIMIT` | Max escalations from one agent in an hour before further payments auto-escalate (default 3) |
| `SLACK_WEBHOOK_URL` | Optional — sends escalation notifications to Slack |
| `SLACK_SIGNING_SECRET` | Optional — verifies Slack interactive callbacks (HMAC) |
| `CHECKPOINT_INTERNAL_URL` | Where the dashboard forwards escalation resolutions |
| `DASHBOARD_URL` | Used for the "open dashboard" link in Slack messages |
| `WALLET_PRIVATE_KEY` | Optional — when set, the x402 handler signs real EIP-3009 USDC transfers on Base Sepolia instead of returning mock receipts |

---

## Project layout

```
agentvault/
├── apps/
│   ├── dashboard/          # Next.js — registration, spending tree, live log, escalation queue
│   └── checkpoint/         # Express — the control plane (decision pipeline + protocol handlers)
├── packages/
│   ├── sdk/                # @vanditk2/agentvault-sdk — developer-facing client (workspace package)
│   ├── trust/              # @agentvault/trust — TrustProvider + SimpleTrustProvider
│   └── types/              # shared TypeScript types
├── prisma/
│   ├── schema.prisma       # Agent / Transaction / Escalation
│   └── migrations/         # committed SQL migrations
├── scripts/
│   ├── seed.ts             # demo data
│   ├── demo-fire.ts        # one-command demo payments
│   └── wallet-bootstrap.ts # generates a wallet for real x402 settlement
├── docker-compose.yml      # local Postgres
└── railway.json            # Railway build/deploy config
```

---

## Tech stack

- **Dashboard** — Next.js 16, React 19, Tailwind v4, [@xyflow/react](https://reactflow.dev/) for the spending tree, Recharts for the analytics
- **Checkpoint** — Express on Node 20, `jsonwebtoken` for credentials, Node `crypto` for Slack HMAC, `@x402/axios` + `@x402/evm` + `viem` for real x402 settlement
- **Data** — Prisma 6 + Postgres
- **Monorepo** — npm workspaces; shared `sdk`, `trust`, and `types` packages consumed by both apps

---

## Contributing

Contributions welcome — especially on the gaps listed in [What works today, and what doesn't](#what-works-today-and-what-doesnt).

```bash
git clone https://github.com/vandit-kunapareddi/agentvault
cd agentvault
npm install
docker compose up -d
cp .env.example .env  # then edit JWT_SECRET
npm run db:migrate:deploy
npm run db:generate
npm run dev
```

For substantial changes (new protocol handler, new trust provider, schema changes), please open an issue first to discuss the approach. Smaller fixes can go straight to a PR.

---

## Roadmap

Roughly in priority order:

- **Complete the protocol layer.** Real MPP sessions / streaming / subscriptions. Full ACP checkout execution (Shared Payment Token, cart, fulfillment). AP2 mandate support. TAP integration.
- **Extensibility surface.** Handler registry so external packages can register protocol handlers at runtime. Documented `TrustProvider` interface + reference implementations.
- **Behavioural trust model.** Once enough real transaction data accumulates, per-agent-type spending signatures and deviation-based escalation, beyond simple rule violations.
- **Intelligence layer.** Spend forecasting (already present in the dashboard), policy templates (present), total agent cost dashboard (LLM token costs + payment costs unified), payment-failure intelligence.
- **Hosted multi-tenant version.** Auth, tenants, CDP server wallets per tenant (so the platform never holds keys), Stripe billing, custom domain.

---

## License

[MIT](./LICENSE)
