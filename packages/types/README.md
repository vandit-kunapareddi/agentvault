# `@vanditk2/agentvault-types`

Shared TypeScript types for [AgentVault](https://github.com/vandit-kunapareddi/agentvault) — the public contract every external protocol handler, trust provider, or webhook consumer is written against.

## Install

```bash
npm install @vanditk2/agentvault-types
```

## What's in here

Just types. No runtime code, no dependencies.

- `Protocol` — `"x402" | "mpp" | "acp" | "unknown"` (the union widens to any string so you can register custom protocols)
- `CredentialPayload` — the JWT shape the checkpoint issues + verifies
- `CheckpointRequest` / `CheckpointResponse` / `CheckpointStatus`
- `PaymentReceipt`
- `HandlerArgs` / `ProtocolHandler` — the contract every protocol handler implements
- `EscalationStatus` / `EscalationDecision` / `EscalationRow` / `ResolveEscalationRequest`

## When to use it

If you're writing **a custom protocol handler** to register with the AgentVault checkpoint, you'll import `ProtocolHandler`, `HandlerArgs`, `PaymentReceipt`. See [`examples/custom-protocol-handler`](https://github.com/vandit-kunapareddi/agentvault/tree/main/examples/custom-protocol-handler) for a worked example.

If you're writing **a webhook subscriber**, the event payload shapes are documented in [`docs/WEBHOOKS.md`](https://github.com/vandit-kunapareddi/agentvault/blob/main/docs/WEBHOOKS.md) — they reference these types.

If you're building **an agent that pays through AgentVault**, you probably want [`@vanditk2/agentvault-sdk`](https://www.npmjs.com/package/@vanditk2/agentvault-sdk) instead, which re-exports the relevant types.

## License

[MIT](./LICENSE)
