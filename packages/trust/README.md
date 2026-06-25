# `@vanditk2/agentvault-trust`

The `TrustProvider` interface for [AgentVault](https://github.com/vandit-kunapareddi/agentvault), plus `SimpleTrustProvider` as a reference implementation. Write your own provider against this contract — on-chain reputation, behavioural scoring, identity-attested, anything — and drop it in behind the checkpoint's trust gate.

## Install

```bash
npm install @vanditk2/agentvault-trust
```

## What's in here

```ts
export interface TrustProvider {
  gate(ctx: AgentTrustContext): Promise<GateResult>;
}

export interface AgentTrustContext {
  walletAddress: string;
  known: boolean;
  active: boolean;
}

export interface GateResult {
  tier: string;        // "verified" | "probation" | "expired" | "unknown" | ...
  score: number;       // 0–100
  allow: boolean;
  reason?: string;     // populated when `allow` is false
}

export class SimpleTrustProvider implements TrustProvider {
  constructor(options?: { minScore?: number });
  gate(ctx: AgentTrustContext): Promise<GateResult>;
}
```

## Implementing your own

```ts
import type {
  AgentTrustContext,
  GateResult,
  TrustProvider,
} from "@vanditk2/agentvault-trust";

export class MyProvider implements TrustProvider {
  async gate(ctx: AgentTrustContext): Promise<GateResult> {
    // Score the agent however you want — on-chain lookup, internal
    // ML model, external reputation API, etc.
    const score = await scoreFromMyService(ctx.walletAddress);
    return {
      tier: score >= 80 ? "verified" : "untrusted",
      score,
      allow: score >= 70,
      reason: score < 70 ? "Below threshold" : undefined,
    };
  }
}
```

A runnable reference implementation (calling an external reputation HTTP service, with full never-fail-open error handling) lives at [`examples/custom-trust-provider`](https://github.com/vandit-kunapareddi/agentvault/tree/main/examples/custom-trust-provider).

## Wiring it into the checkpoint

Swap `SimpleTrustProvider` for your class in [`apps/checkpoint/src/trust.ts`](https://github.com/vandit-kunapareddi/agentvault/blob/main/apps/checkpoint/src/trust.ts) — one-line change.

## License

[MIT](./LICENSE)
