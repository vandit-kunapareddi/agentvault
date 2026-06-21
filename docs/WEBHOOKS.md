# Webhooks

Subscribe an external service to checkpoint events — `transaction.approved`, `transaction.blocked`, escalation lifecycle, etc. Each delivery is an HMAC-signed POST so your subscriber can verify it came from AgentVault.

This is the official subscriber-side reference. To extend the checkpoint itself with new protocols or trust providers, see [docs/EXTENDING.md](./EXTENDING.md).

---

## Event catalog

Every event has the shape `{ event, deliveredAt, data }`. `event` is the type string, `deliveredAt` is an ISO-8601 timestamp, `data` carries the event-specific payload.

| Event | Fires when | `data` fields |
|---|---|---|
| `transaction.approved` | A payment is approved and settled | `transactionId`, `agentId`, `agentName`, `vendor`, `amount`, `protocol`, `trustTier`, `status: "approved"`, `reason`, `createdAt` |
| `transaction.blocked` | A payment is blocked (any reason — budget, trust, vendor, settlement failure, auto-block on timeout) | same as `transaction.approved` but `status: "blocked"` and `reason` is populated |
| `transaction.recognized` | A protocol handler returned `settled: false` (e.g. ACP today) | same as `transaction.approved` but `status: "recognized"` |
| `escalation.created` | A payment is paused for human review | `escalationId`, `transactionId`, `agentId`, `agentName`, `vendor`, `amount`, `reason`, `createdAt`, `deadlineAt` |
| `escalation.resolved` | A human resolves an escalation via dashboard or Slack | `escalationId`, `transactionId`, `agentId`, `decision: "approved"` or `"blocked"`, `resolvedBy`, `resolvedAt` |
| `escalation.timed_out` | An escalation expired with no decision (the payment is auto-blocked) | `escalationId`, `transactionId`, `agentId`, `timedOutAt` |

When an escalation is approved by a human and settlement then succeeds, you'll receive **both** `escalation.resolved` (decision: approved) **and** `transaction.approved` for the same `transactionId`. When it's blocked, you'll receive `escalation.resolved` (decision: blocked) and `transaction.blocked`.

### Example payload

```json
{
  "event": "transaction.approved",
  "deliveredAt": "2026-06-21T18:05:12.345Z",
  "data": {
    "transactionId": "ckpr1jftu0000js0475seiq8e",
    "agentId": "seed-research",
    "agentName": "Research Agent",
    "vendor": "exa.ai",
    "amount": 0.05,
    "protocol": "x402",
    "trustTier": "verified",
    "status": "approved",
    "reason": null,
    "createdAt": "2026-06-21T18:05:12.123Z"
  }
}
```

---

## Headers on every delivery

| Header | Meaning |
|---|---|
| `Content-Type: application/json` | Body is the JSON event payload |
| `X-AgentVault-Event` | The event type — same as `payload.event`; useful for routing without parsing the body |
| `X-AgentVault-Timestamp` | Unix epoch seconds when the signature was computed |
| `X-AgentVault-Signature` | `v0=<hex-hmac-sha256>` (see below) |
| `X-AgentVault-Delivery` | Unique UUID per delivery attempt — log it for debugging |

---

## Signature verification

The signature uses the same shape as Slack's webhook signing.

1. Concatenate `v0:` + the `X-AgentVault-Timestamp` header value + `:` + the raw request body
2. HMAC-SHA-256 it with the webhook's secret
3. Prefix with `v0=` and compare in constant time against `X-AgentVault-Signature`

### Node.js example

```ts
import crypto from "node:crypto";
import express from "express";

const app = express();

// Important: capture the raw body so the signature input matches what
// the dispatcher used. JSON parsing AFTER verification.
app.post(
  "/agentvault-webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const timestamp = req.header("x-agentvault-timestamp");
    const signature = req.header("x-agentvault-signature");
    if (!timestamp || !signature) return res.status(401).end();

    // Reject deliveries with a wildly skewed timestamp (replay protection).
    const ageSec = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(ageSec) || ageSec > 5 * 60) {
      return res.status(401).end();
    }

    const body = (req.body as Buffer).toString("utf8");
    const expected =
      "v0=" +
      crypto
        .createHmac("sha256", process.env.WEBHOOK_SECRET!)
        .update(`v0:${timestamp}:${body}`)
        .digest("hex");

    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(signature, "utf8");
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).end();
    }

    const event = JSON.parse(body);
    // ... do something with the event
    res.status(200).end();
  },
);
```

### Why timing-safe compare?

A naive `if (expected === signature)` leaks timing information that lets an attacker incrementally guess the signature. `crypto.timingSafeEqual` runs in constant time regardless of how many bytes match.

---

## Retry semantics

The dispatcher attempts each delivery up to **three times** with a `[0, 1s, 3s]` backoff:

- **2xx** → success, stop
- **408 (Request Timeout) / 429 (Too Many Requests) / 5xx** → retry
- **4xx (any other)** → treated as permanent, stop without retry
- **Network error** (DNS, connection refused, TLS, etc.) → retry

The final attempt's status code (or `0` for network error) is recorded on the webhook row as `lastDeliveryStatus`. If a delivery still failed after all attempts, the webhook stays active — the next event fires a fresh delivery. There is no separate retry queue for failed deliveries today.

### Idempotency

The same delivery attempt is **not** retried with a fresh `X-AgentVault-Delivery` id — all retries within a single dispatch share the same id. The next delivery for the same event would only happen if the event itself fires twice (which the checkpoint will not do for a given transaction state transition).

Your subscriber should treat the `transactionId` (or `escalationId`) as the natural idempotency key when applying the event.

---

## Managing webhooks

### Dashboard

Open `/webhooks` in your AgentVault dashboard. From there you can:

- See every registered webhook, last-delivery status, and event filter
- Create a new webhook (the secret is shown **exactly once** — copy it then)
- Pause / resume a webhook
- Delete a webhook

### API

```http
GET  /api/webhooks                  → list (secret NOT included)
POST /api/webhooks                  → create (response body includes secret ONCE)
PATCH /api/webhooks/:id             → update url / description / eventFilter / isActive
DELETE /api/webhooks/:id            → delete
```

POST body:

```json
{
  "url": "https://hooks.example.com/agentvault",
  "description": "Datadog audit ingest",
  "eventFilter": ["transaction.blocked", "escalation.created"]
}
```

`eventFilter: null` (or omitted) means deliver every event. An array means deliver only the listed types.

The `secret` returned on POST is the only time it leaves the server. If you lose it, delete the webhook and create a new one — the dashboard cannot retrieve it later.

---

## Limitations to know about

- **No auth on the management API today.** The dashboard has no user accounts yet, so anyone with dashboard access can create webhooks. This is consistent with the rest of the system. Multi-tenant auth is roadmap.
- **Secret is stored in plaintext in Postgres.** Encrypt-at-rest is roadmap. For now, treat database access as already-trusted access to webhook secrets.
- **No replay of failed deliveries today.** Failed deliveries are recorded in `lastDeliveryStatus` and `lastDeliveryError` but you can't trigger a manual retry from the dashboard. Coming with the next iteration of this feature.
- **No delivery history table.** Only the last attempt is recorded. A per-delivery audit log is a planned follow-up.
