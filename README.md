# AgentVault

A trust and control layer between AI agents and [x402](https://www.x402.org/) payments.

> **Hackathon submission — in progress.** Days 1–3 of 5 complete. See [Status](#status) for what works today.

## The problem

AI agents are starting to spend money autonomously via x402 — paying for APIs, data, and compute per request, with no human in the loop. There's no independent enforcement layer for this. Today's options are:

- Spending limits live inside the agent's own code — if it misbehaves, the limits go with it.
- Sub-agents that the agent hires are a black box — you only see your top-level agent's activity.
- No mechanism to pause and ask "did you mean to do this?" when something unusual happens.

## The solution

AgentVault sits between an agent and the payment network. Developers register their agent and define a **spending credential** — a signed, scoped set of rules:

- Per-transaction limit
- Daily budget cap
- Approved vendor whitelist
- Expiry time
- Who authorized this agent

Every payment passes through a checkpoint. The checkpoint verifies the credential, evaluates each rule, and either approves, blocks, or escalates the payment. Everything is logged. The dashboard shows the full spending tree, including sub-agents the top-level agent hired.

## Architecture

```
┌──────────┐   payment       ┌────────────┐  approved   ┌────────────┐
│   Agent  │ ──────────────▶ │ Checkpoint │ ──────────▶ │  x402      │
│ (any LLM)│   + credential  │  (Express) │             │  vendor    │
└──────────┘                 └─────┬──────┘             └────────────┘
                                   │
                                   │ writes Transaction rows
                                   ▼
                             ┌─────────────┐
                             │  SQLite     │
                             │  (Prisma)   │
                             └──────┬──────┘
                                    │
                                    ▼
                             ┌─────────────┐
                             │  Dashboard  │
                             │  (Next.js)  │
                             └─────────────┘
```

The checkpoint runs every payment through:
1. JWT signature → invalid → **block**
2. Expiry → expired → **block**
3. Amount vs per-tx limit → over → **block**
4. Vendor on whitelist → not listed → **escalate**
5. Today's spend + amount vs daily cap → over → **block**
6. Within 10% of daily cap → **escalate**
7. **approve**

## Repo layout

```
agentvault/
├── apps/
│   ├── dashboard/      # Next.js 16 — agent registration, live transaction log, spending tree
│   └── checkpoint/     # Express server — the verification pipeline + mock x402 endpoint
├── packages/
│   └── types/          # Shared TypeScript types (credential payload, request/response shapes)
└── prisma/
    └── schema.prisma   # Agent / Transaction / Escalation models, SQLite
```

## Running locally

Requires Node 20+, npm 9+.

```bash
git clone https://github.com/vanditkunapareddi-jpg/agentvault
cd agentvault
cp .env.example .env          # then edit JWT_SECRET to a real random string
npm install
npm run db:push               # creates prisma/dev.db and applies the schema
npm run dev:dashboard         # http://localhost:3000
npm run dev:checkpoint        # http://localhost:4000
```

Register an agent at `/agents/new`, copy the issued JWT from the agent detail page, and use it against the checkpoint:

```bash
curl -X POST http://localhost:4000/checkpoint \
  -H "content-type: application/json" \
  -d '{"credential":"<paste>","vendor":"exa.ai","amount":0.10}'
```

## Status

**Done**
- ✅ Monorepo (npm workspaces) + Prisma + SQLite
- ✅ Agent registration with signed JWT credential issuance
- ✅ Checkpoint pipeline with all 7 verification steps, transaction logging
- ✅ Mock x402 vendor endpoint
- ✅ Dashboard: live-updating transaction log with status filters, React Flow spending tree with parent→child agent hierarchy, per-agent transaction history, consistent status indicators

**In progress**
- ⏳ Day 4 — Slack webhook escalations + 60s hold-and-wait for human approval
- ⏳ Day 5 — Deploy to Vercel + Railway, demo video, submission polish

## Tech stack

- **Frontend** — Next.js 16, React 19, Tailwind v4, [@xyflow/react](https://reactflow.dev/) for the tree
- **Checkpoint** — Express on Node 20, `jsonwebtoken` for credential verification
- **Data** — Prisma 6 + SQLite (single `prisma/dev.db`)
- **Shared** — TypeScript types in `packages/types/` consumed by both apps via workspace resolution

## Solo hackathon notes

This is a 5-day solo build. The checkpoint orchestration ([apps/checkpoint/src/checkpoint.ts](apps/checkpoint/src/checkpoint.ts)) is the heart — every payment decision flows through one function. The dashboard polls (`@2.5s`) rather than using SSE/WebSockets to keep the deploy surface as small as possible. The mock x402 endpoint mirrors the real protocol's request/response shape so swapping in the real network post-hackathon is a single change.
