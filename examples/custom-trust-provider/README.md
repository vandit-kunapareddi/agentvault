# Example: custom `TrustProvider`

A reference implementation of a `TrustProvider` that delegates trust scoring to an external reputation service over HTTP. Demonstrates the patterns from [docs/EXTENDING.md](../../docs/EXTENDING.md#trust-providers):

- Implementing the `TrustProvider` interface end-to-end
- The **never-fail-open** principle: every error path (service down, non-OK response, malformed body) returns `allow: false` with a clear reason — never a default-allow
- Injectable `fetch` so the unit tests don't need a network

## What it does

`ReputationServiceProvider` calls `GET ${serviceUrl}/score/${walletAddress}`, expects a JSON response `{ score: number }`, and maps:

- `score >= 80` → tier `verified`
- `score >= 50` → tier `probation`
- otherwise   → tier `untrusted`

The agent is allowed if `score >= minScore` (default 70). Anything that goes wrong (network error, HTTP 4xx/5xx, non-numeric score) blocks the payment with a clear reason logged into the dashboard.

## Wiring it into the checkpoint

Swap `SimpleTrustProvider` for this class in [`apps/checkpoint/src/trust.ts`](../../apps/checkpoint/src/trust.ts):

```ts
// Before
import { SimpleTrustProvider } from "@agentvault/trust";
const provider: TrustProvider = new SimpleTrustProvider({ minScore: getMinScore() });

// After
import { ReputationServiceProvider } from "@agentvault-examples/trust-provider";
const provider: TrustProvider = new ReputationServiceProvider({
  serviceUrl: process.env.REPUTATION_SERVICE_URL!,
  minScore: getMinScore(),
});
```

That's the whole change. The checkpoint's decision pipeline doesn't care which implementation is behind the interface.

## Running the tests

```bash
npm test --workspace=@agentvault-examples/trust-provider
```

The tests inject a fake `fetch` to exercise every branch (success, low-score block, HTTP error, network error, malformed body, URL normalisation) without hitting a real network.
