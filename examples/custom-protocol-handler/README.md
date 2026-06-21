# Example: custom `ProtocolHandler`

A reference implementation of a `ProtocolHandler` for a fictional `ledger-pay` protocol. Demonstrates the patterns from [docs/EXTENDING.md](../../docs/EXTENDING.md#protocol-handlers):

- Implementing the `ProtocolHandler` contract (`HandlerArgs` in, `PaymentReceipt` out)
- All three return shapes a handler can produce:
  - **approved** — return a receipt with `settled: true`
  - **recognized** — return a receipt with `settled: false` (the checkpoint logs this as a distinct status, e.g. for ACP-style handlers that acknowledge but don't yet execute)
  - **blocked** — throw an error; the checkpoint catches it and surfaces it as a blocked transaction with the error message as the reason
- Injectable `fetch` so the unit tests don't need a network

## What it does

`createLedgerPayHandler({ ledgerUrl })` returns a `ProtocolHandler` that:

1. Sends `POST ${ledgerUrl}/record` with `{ vendor, amount, endpoint }`
2. Expects `{ entryId, deferred? }` back
3. Returns a `PaymentReceipt` with `protocol: "ledger-pay"` and `receiptId: entryId`
4. Marks the receipt `settled: true` if the ledger settled inline, or `settled: false` if the ledger acknowledged but is deferring settlement

## Wiring it into the checkpoint

Register the handler at boot — anywhere that runs before the first request lands. The cleanest place is right after the built-in registrations in [`apps/checkpoint/src/index.ts`](../../apps/checkpoint/src/index.ts):

```ts
import { registerHandler } from "./router.js";
import { createLedgerPayHandler } from "@agentvault-examples/protocol-handler";

registerHandler(
  "ledger-pay",
  createLedgerPayHandler({ ledgerUrl: process.env.LEDGER_URL! }),
);
```

That's it. The checkpoint will now route any `protocol: "ledger-pay"` request to your handler.

## Telling the SDK

The SDK's `detectProtocol` only probes for the four built-in values (x402, mpp, acp, unknown). For a custom protocol, the agent has to pass `protocol: "ledger-pay"` explicitly in its `vault.pay()` call — see the SDK-detection caveat in [docs/EXTENDING.md](../../docs/EXTENDING.md#telling-the-sdk-about-your-new-protocol).

## Running the tests

```bash
npm test --workspace=@agentvault-examples/protocol-handler
```

The tests inject a fake `fetch` to exercise success, deferred settlement, HTTP errors, malformed responses, missing endpoint, and network errors — without hitting a real network.
