# AgentVault

**One SDK. Any protocol. Full control.**

AgentVault is a payment router and control layer for autonomous AI agents. Drop one SDK into your agent and it can pay for services across multiple agentic payment protocols — with identity/trust verification, budget enforcement, full cross-agent spending visibility, and human-in-the-loop escalation built in.

The agentic payment landscape has fragmented into several competing protocols (x402, MPP, ACP, and more). Each handles *how* a payment moves, but none answers the questions a developer actually cares about: **Should this agent be trusted to pay? Is this within its budget? What is my whole agent ecosystem spending? And can I step in before something unusual goes through?** AgentVault is the layer that answers those — across protocols, through one interface.

## Why

When you give an agent the ability to spend money, three gaps appear:

- **Limits live inside the agent.** If the agent misbehaves or is compromised, the limits go with it. Enforcement needs to be external.
- **Sub-agents are a black box.** Agents hire other agents, which spend too. You only see your top-level agent — everything downstream is invisible.
- **No safety net.** Every protocol is built for full autonomy. There's no mechanism to pause a payment and ask "did you mean to do this?" before it executes.

AgentVault closes all three: an independent checkpoint enforces rules outside the agent, a live spending tree shows the full agent hierarchy, and unusual payments are paused for human approval.

## How it works

```
   ┌──────────┐
   │  Agent   │  vault.pay({ endpoint, maxAmount })
   │  (SDK)   │
   └────┬─────┘
        │ 1. detect protocol from the endpoint
        ▼
   ┌─────────────────────────────────────────────┐
   │             Checkpoint (Express)             │
   │                                              │
   │  2. verify signed credential (JWT)           │
   │  3. trust gate  (pluggable TrustProvider)    │
   │  4. per-transaction limit                    │
   │  5. vendor whitelist        → escalate       │
   │  6. daily budget cap                         │
   │  7. near-cap warning        → escalate       │
   │  8. route → protocol handler → receipt       │
   │                                              │
   │   ┌────────┐  ┌────────┐  ┌────────┐         │
   │   │  x402  │  │  MPP   │  │  ACP   │  (+more) │
   │   └────────┘  └────────┘  └────────┘         │
   └───────┬───────────────────────────┬──────────┘
           │ writes Transaction rows    │ on escalate
           ▼                            ▼
     ┌──────────┐               ┌───────────────┐
     │  SQLite  │               │ Slack + queue │
     │ (Prisma) │               │  (approve /   │
     └────┬─────┘               │    block)     │
          │                     └───────────────┘
          ▼
    ┌─────────────┐
    │  Dashboard  │  spending tree · live log · escalation queue
    │  (Next.js)  │
    └─────────────┘
```

Every payment attempt runs through the checkpoint pipeline in order; each step can short-circuit:

1. **Credential** — verify the JWT signature → tampered → **block**
2. **Expiry** — credential expired → **block**
3. **Trust gate** — agent's trust score below the configured minimum → **block**
4. **Per-transaction limit** — amount over the cap → **block**
5. **Vendor whitelist** — vendor not approved → **escalate**
6. **Daily budget** — today's spend + amount over the daily cap → **block**
7. **Near-cap** — within 10% of the daily cap → **escalate**
8. **Route** — approved payments are dispatched to the matching protocol handler, which returns a settlement receipt

An escalated payment is **held** for a configurable window while a human decides (via Slack or the dashboard). If no decision arrives in time it **auto-blocks** — it never fails open.

## Spending credential

Each agent gets a signed JWT that travels with it. Rules live in the credential, not in the agent's own code, so they're enforced even if the agent is compromised:

```json
{
  "agentId": "clx123abc",
  "agentName": "Research Agent",
  "walletAddress": "0x52ce…",
  "authorizedBy": "developer@example.com",
  "dailyCap": 10.0,
  "perTxLimit": 0.5,
  "approvedVendors": ["exa.ai", "hyperbolic.xyz"],
  "supportedProtocols": ["x402", "mpp", "acp"],
  "issuedAt": 1748390400,
  "expiresAt": 1748476800
}
```

## SDK usage

```ts
import { AgentVault } from "@agentvault/sdk";

const vault = new AgentVault({
  credential: process.env.AGENT_CREDENTIAL, // the signed JWT
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

`pay()` detects the protocol the endpoint expects, then routes the request through the checkpoint, which verifies trust, enforces budget rules, escalates if needed, and dispatches to the right protocol handler.

## Pluggable trust

Trust verification is a vendor-neutral interface:

```ts
interface TrustProvider {
  gate(ctx: AgentTrustContext): Promise<GateResult>; // { tier, score, allow }
}
```

AgentVault ships with `SimpleTrustProvider`, which scores agents from their registration standing. Any external identity/reputation service can implement the same interface and drop in without touching the checkpoint pipeline. The minimum score required to transact is configurable via `MIN_TRUST_SCORE`.

## Protocol support

| Protocol | Status |
|----------|--------|
| **x402** | Full handler |
| **MPP**  | Routing + response shape implemented; execution stubbed |
| **ACP**  | Routing + response shape implemented; execution stubbed |

Payment execution currently runs against local mock handlers. The routing layer and receipt shapes mirror the real protocols, so live adapters slot in behind the existing interface without pipeline changes.

## Quickstart

Requires Node 20+ and npm 9+.

```bash
git clone https://github.com/vanditkunapareddi-jpg/agentvault
cd agentvault
cp .env.example .env          # set JWT_SECRET to a long random string
npm install
npm run db:push               # creates prisma/dev.db and applies the schema
npm run dev                    # starts checkpoint (:4000) + dashboard (:3000)
```

Open the dashboard at `http://localhost:3000`, register an agent, and copy its credential from the agent detail page. Then have an agent pay:

```bash
curl -X POST http://localhost:4000/checkpoint \
  -H "content-type: application/json" \
  -d '{"credential":"<paste JWT>","vendor":"exa.ai","amount":0.10,"protocol":"x402"}'
```

The checkpoint exposes mock service endpoints (`/mock/x402`, `/mock/mpp`, `/mock/acp`) that return `402` with a protocol header, so the SDK's protocol detection has something to probe locally.

## Configuration

All configuration is via `.env` (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLite connection string (`file:./dev.db`) |
| `JWT_SECRET` | Signs and verifies spending credentials |
| `MIN_TRUST_SCORE` | Minimum trust score (0–100) an agent must clear to transact |
| `ESCALATION_TIMEOUT_MS` | How long a held payment waits before auto-blocking |
| `SLACK_WEBHOOK_URL` | Optional — sends escalation notifications |
| `SLACK_SIGNING_SECRET` | Optional — verifies Slack interactive callbacks (HMAC) |
| `CHECKPOINT_INTERNAL_URL` | Where the dashboard forwards escalation resolutions |
| `DASHBOARD_URL` | Used for the "open dashboard" link in Slack messages |

## Project layout

```
agentvault/
├── apps/
│   ├── dashboard/          # Next.js — registration, spending tree, live log, escalation queue
│   │   └── app/
│   │       ├── page.tsx            # spending tree + agents
│   │       ├── transactions/       # live transaction log
│   │       ├── escalations/        # pending-approval queue
│   │       └── api/                # agents, transactions, escalations
│   └── checkpoint/         # Express — the control plane
│       └── src/
│           ├── checkpoint.ts       # the decision pipeline
│           ├── credential.ts       # JWT verification
│           ├── budget.ts           # daily-spend accounting
│           ├── whitelist.ts        # vendor checks
│           ├── trust.ts            # trust gate wiring
│           ├── escalation.ts       # hold-and-wait + resolution
│           ├── slack.ts            # webhook + signature verification
│           ├── router.ts           # protocol dispatch
│           ├── handlers/           # x402 / mpp / acp
│           └── mock-services.ts    # local 402 endpoints for protocol detection
├── packages/
│   ├── sdk/                # @agentvault/sdk — developer-facing client
│   ├── trust/              # @agentvault/trust — TrustProvider + SimpleTrustProvider
│   └── types/             # shared TypeScript types
└── prisma/
    └── schema.prisma       # Agent / Transaction / Escalation, SQLite
```

## Tech stack

- **Dashboard** — Next.js 16, React 19, Tailwind v4, [@xyflow/react](https://reactflow.dev/) for the spending tree
- **Checkpoint** — Express on Node 20, `jsonwebtoken` for credentials, Node `crypto` for Slack HMAC
- **Data** — Prisma 6 + SQLite
- **Monorepo** — npm workspaces; shared `sdk`, `trust`, and `types` packages consumed by both apps

## Roadmap

- Live protocol adapters (real x402 settlement, full MPP sessions, ACP checkout)
- Additional `TrustProvider` implementations
- Anomaly-based escalation triggers (unfamiliar vendor, request-rate spikes)
- Postgres for multi-instance deployments

## License

MIT
