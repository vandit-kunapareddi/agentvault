# Extending AgentVault

AgentVault has two main extension points:

- **Protocol handlers** — add support for a new agentic payment protocol (e.g. AP2, TAP), or replace a built-in mock with a real implementation.
- **Trust providers** — swap `SimpleTrustProvider` for a custom trust / identity / behavioural source.

Both keep the rest of the checkpoint pipeline untouched. If you find yourself needing to fork anything *outside* these extension points to extend AgentVault, open an issue — that's a gap we want to close.

---

## Protocol handlers

The handler registry lives at [`apps/checkpoint/src/router.ts`](../apps/checkpoint/src/router.ts). Each handler implements the `ProtocolHandler` contract:

```ts
import type { PaymentReceipt } from "@agentvault/types";
import type { HandlerArgs } from "./handlers/receipt.js";

export type ProtocolHandler = (args: HandlerArgs) => Promise<PaymentReceipt>;
```

### `HandlerArgs` — what the handler receives

```ts
interface HandlerArgs {
  vendor: string;       // hostname extracted from the endpoint, e.g. "api.exa.ai"
  amount: number;       // amount in USDC (decimal dollars)
  endpoint?: string;    // the full URL the agent asked to pay; optional
}
```

The pipeline only routes to a handler **after** all the budget, trust, and vendor checks have passed. By the time your handler runs, the payment has been authorised — your job is to actually execute it (or mock it).

### `PaymentReceipt` — what the handler must return

```ts
interface PaymentReceipt {
  protocol: Protocol;    // e.g. "ap2"
  receiptId: string;     // your settlement ID, tx hash, etc.
  vendor: string;        // typically the same vendor you received
  amount: number;        // typically the same amount you received
  currency: "USDC";      // currency is fixed today
  settled: boolean;      // false → checkpoint logs the tx as "recognized" instead of "approved"
  timestamp: string;     // ISO-8601
}
```

Use the [`makeReceipt`](../apps/checkpoint/src/handlers/receipt.ts) helper to construct one with sane defaults.

### Error semantics

- **Throw** to signal settlement failure. The checkpoint's `finalizeApproved` catches the exception and surfaces it as a **blocked** transaction with the error message as the reason, so it lands in the dashboard log instead of becoming a 500.
- **Return `settled: false`** to signal "I recognised this protocol but didn't execute it yet" (this is what the built-in ACP handler does). The transaction is logged with status `recognized`, distinct from `approved`.

### A worked example

Say you want to add support for a hypothetical `bitcoin-lightning` protocol:

```ts
// my-bolt-handler.ts
import type { PaymentReceipt } from "@agentvault/types";
import type { ProtocolHandler } from "@agentvault/checkpoint/router";  // workspace import
import { makeReceipt } from "@agentvault/checkpoint/handlers/receipt";
import { sendLightningPayment } from "./my-lightning-client";

export const lightningHandler: ProtocolHandler = async (args) => {
  if (!args.endpoint) {
    throw new Error("lightning handler requires an endpoint to fetch the invoice from");
  }
  try {
    const result = await sendLightningPayment(args.endpoint, args.amount);
    const receipt: PaymentReceipt = makeReceipt(
      "bitcoin-lightning",
      args.vendor,
      result.amountSettled,
      true,
    );
    receipt.receiptId = result.preimage;
    return receipt;
  } catch (err) {
    throw new Error(
      `lightning payment failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};
```

### Wiring it up

Register the handler at boot — anywhere that runs before the first request lands. The cleanest place is right after the existing built-in registrations in `apps/checkpoint/src/index.ts`:

```ts
import { registerHandler } from "./router.js";
import { lightningHandler } from "./my-bolt-handler.js";

registerHandler("bitcoin-lightning", lightningHandler);
```

Re-registering an existing protocol replaces the previous handler — useful for swapping out a built-in mock with a real implementation under the same protocol name.

### Sanity-checking what's registered

```ts
import { listRegisteredProtocols } from "./router.js";
console.log(listRegisteredProtocols());
// → ["x402", "mpp", "acp", "bitcoin-lightning"]
```

### Telling the SDK about your new protocol

The SDK's [`detectProtocol`](../packages/sdk/src/index.ts) only probes for the four built-in values (x402, mpp, acp, unknown). For a custom protocol you have two options today:

1. **Bypass detection** — have the agent pass `protocol: "bitcoin-lightning"` explicitly in its `vault.pay()` call (the SDK forwards it through to the checkpoint). This requires a small SDK extension to accept an explicit protocol override; PR welcome.
2. **Fork `detectProtocol`** to also recognise your custom 402-response header pattern.

A handler-registry-style extension on the SDK side is a planned follow-up.

---

## Trust providers

The trust gate runs early in the checkpoint pipeline (right after credential verification, before any budget check) and decides whether an agent is even allowed to attempt a payment. The contract lives in `@agentvault/trust`:

```ts
interface TrustProvider {
  gate(ctx: AgentTrustContext): Promise<GateResult>;
}

interface AgentTrustContext {
  walletAddress: string;
  known: boolean;     // is this wallet a registered agent in AgentVault?
  active: boolean;    // does the agent have a non-expired credential?
}

interface GateResult {
  tier: string;       // a human-readable label ("verified", "probation", "expired", ...)
  score: number;      // 0–100, must be >= MIN_TRUST_SCORE for `allow: true`
  allow: boolean;     // false → checkpoint blocks the payment with `reason`
  reason?: string;    // surfaced in the dashboard when a payment is blocked
}
```

The default implementation is [`SimpleTrustProvider`](../packages/trust/src/index.ts) — it scores based on whether the wallet is registered and whether the credential is still active. Read it for a reference shape.

### A worked example — custom provider

Say you want a provider that calls your in-house reputation service:

```ts
// my-reputation-provider.ts
import type {
  AgentTrustContext,
  GateResult,
  TrustProvider,
} from "@agentvault/trust";

export class ReputationServiceProvider implements TrustProvider {
  constructor(private readonly serviceUrl: string, private readonly minScore = 70) {}

  async gate(ctx: AgentTrustContext): Promise<GateResult> {
    // Never fail open — if the service is unreachable, block.
    let score: number;
    try {
      const res = await fetch(`${this.serviceUrl}/score/${ctx.walletAddress}`);
      if (!res.ok) {
        return {
          tier: "unknown",
          score: 0,
          allow: false,
          reason: `Reputation service returned ${res.status}`,
        };
      }
      ({ score } = await res.json());
    } catch (err) {
      return {
        tier: "unknown",
        score: 0,
        allow: false,
        reason: `Reputation service unreachable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    return {
      tier: score >= 80 ? "verified" : score >= 50 ? "probation" : "untrusted",
      score,
      allow: score >= this.minScore,
      reason: score < this.minScore ? "Reputation score below required threshold" : undefined,
    };
  }
}
```

### Wiring it up

Today the trust provider is constructed in [`apps/checkpoint/src/trust.ts`](../apps/checkpoint/src/trust.ts). To swap it, edit one line:

```ts
// Before
const provider: TrustProvider = new SimpleTrustProvider({ minScore: getMinScore() });

// After
import { ReputationServiceProvider } from "./my-reputation-provider.js";
const provider: TrustProvider = new ReputationServiceProvider(
  process.env.REPUTATION_SERVICE_URL!,
  getMinScore(),
);
```

That's it. The checkpoint pipeline doesn't care which implementation is behind the interface.

### Things to be aware of

- **Never fail open.** If your provider can't reach its data source, return `allow: false` with a clear reason. A trust gate that lets payments through when it can't decide is worse than no gate at all.
- **Latency matters.** `gate()` is awaited synchronously inside the pipeline — every payment waits on it. Aim for <100ms; if your data source is slow, cache aggressively or do precomputation.
- **The `tier` string is purely cosmetic** — it shows up as a badge in the dashboard and gets logged with the transaction, but the checkpoint only looks at `allow`. Use it however helps you debug ("probation", "fast-track", "rate-limited", whatever).
- **You cannot currently set a TrustProvider at runtime via env var.** Today it's a code change. A dynamic-loading variant (e.g. `TRUST_PROVIDER_MODULE=./my-provider.js`) is a planned follow-up — open an issue if you want to drive that.

---

## Webhook / event API

Not built yet — this is the next item in Phase 2 of the roadmap. If you need to react to checkpoint decisions externally today, your option is to poll `/api/transactions` or `/api/escalations`.

---

## Reference implementations

We're planning to ship one or two reference repos (a custom `TrustProvider`, a custom protocol handler) as living docs. Until those exist, this file is the source of truth — PRs to improve it very welcome.
