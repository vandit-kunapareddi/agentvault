# @vanditk2/agentvault-sdk

TypeScript client for [AgentVault](https://github.com/vandit-kunapareddi/agentvault) — the open-source trust and control layer for AI-agent payments.

> **Heads up:** the SDK on its own doesn't move money. It talks to an AgentVault **checkpoint** (the control plane that verifies the credential, enforces budgets, escalates anything unusual, and routes to the right payment protocol). Today AgentVault is self-host — to use this SDK in production you also need to be running your own checkpoint. See the [main repo](https://github.com/vandit-kunapareddi/agentvault) for the self-host quickstart.

## Install

```bash
npm install @vanditk2/agentvault-sdk
```

Requires Node 20+.

## Usage

```ts
import { AgentVault } from "@vanditk2/agentvault-sdk";

const vault = new AgentVault({
  credential: process.env.AGENT_CREDENTIAL!,   // a signed JWT issued by your AgentVault dashboard
  checkpointUrl: "https://your-checkpoint.example.com",
});

const result = await vault.pay({
  endpoint: "https://api.someservice.com/data",
  maxAmount: 0.05,
});

if (result.status === "approved") {
  // result.protocol → "x402" | "mpp" | "acp"
  // result.receipt  → vendor, amount, settled, timestamp, receiptId
  // result.trustTier
}
```

`pay()` probes the endpoint to detect which agentic payment protocol it speaks (x402 / MPP / ACP), then POSTs to your checkpoint's `/checkpoint` endpoint with the credential + vendor + amount + protocol + endpoint. Your checkpoint runs the full decision pipeline and either approves, escalates (and holds while a human decides), or blocks.

## What the credential carries

The signed JWT encodes the spending rules the checkpoint will enforce:

```json
{
  "agentId": "clx123abc",
  "agentName": "Research Agent",
  "walletAddress": "0x52ce…",
  "authorizedBy": "dev@example.com",
  "dailyCap": 10.0,
  "perTxLimit": 0.5,
  "approvedVendors": ["exa.ai", "hyperbolic.xyz"],
  "vendorLimits": { "exa.ai": 2.0 },
  "supportedProtocols": ["x402", "mpp", "acp"],
  "issuedAt": 1748390400,
  "expiresAt": 1748476800
}
```

Generate these from the AgentVault dashboard's "Register agent" form. The checkpoint verifies the signature against the dashboard's `JWT_SECRET` — both must match.

## What status values mean

| `status` | Meaning |
|---|---|
| `approved` | The payment passed every check and was settled by the matching protocol handler. `receipt` is populated with the on-chain (or mock) settlement details. |
| `recognized` | The protocol was identified but the handler doesn't execute the payment yet (ACP today). `settled: false`. |
| `escalated` | The payment was held while a human reviewed it (then resolved as approved or blocked). |
| `blocked` | A budget, trust, vendor, or settlement check failed. `reason` says which. |

## Direct protocol detection

If you just want to know which protocol an endpoint expects without making a payment:

```ts
import { detectProtocol } from "@vanditk2/agentvault-sdk";

const protocol = await detectProtocol("https://api.someservice.com/data");
// → "x402" | "mpp" | "acp" | "unknown"
```

## License

[MIT](./LICENSE)
