import { describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import {
  dispatchToWebhook,
  isRetryable,
  passesFilter,
  signPayload,
} from "./webhooks.js";
import type { WebhookEventPayload } from "./events.js";

const PAYLOAD: WebhookEventPayload = {
  event: "transaction.approved",
  deliveredAt: "2026-06-21T18:00:00.000Z",
  data: {
    transactionId: "tx_test",
    agentId: "a1",
    agentName: "Research Agent",
    vendor: "exa.ai",
    amount: 0.05,
    protocol: "x402",
    trustTier: "verified",
    status: "approved",
    reason: null,
    createdAt: "2026-06-21T18:00:00.000Z",
  },
};

function mockFetch(...responses: Array<{ ok?: boolean; status: number; throws?: Error }>) {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++] ?? responses[responses.length - 1];
    if (r.throws) throw r.throws;
    return {
      ok: r.ok ?? (r.status >= 200 && r.status < 300),
      status: r.status,
    } as unknown as Response;
  });
}

describe("signPayload", () => {
  it("produces a deterministic v0-prefixed HMAC-SHA-256 signature", () => {
    // Verify the wire format matches what a subscriber would recompute.
    const secret = "test-secret";
    const timestamp = "1748390400";
    const body = '{"event":"transaction.approved"}';
    const expected =
      "v0=" +
      crypto
        .createHmac("sha256", secret)
        .update(`v0:${timestamp}:${body}`)
        .digest("hex");
    expect(signPayload(secret, timestamp, body)).toBe(expected);
  });
  it("different secrets produce different signatures", () => {
    const t = "1748390400";
    const b = "{}";
    expect(signPayload("a", t, b)).not.toBe(signPayload("b", t, b));
  });
});

describe("isRetryable", () => {
  it("retries network errors (status 0)", () => {
    expect(isRetryable(0)).toBe(true);
  });
  it("retries 408 (request timeout) and 429 (rate limited)", () => {
    expect(isRetryable(408)).toBe(true);
    expect(isRetryable(429)).toBe(true);
  });
  it("retries 5xx", () => {
    expect(isRetryable(500)).toBe(true);
    expect(isRetryable(503)).toBe(true);
    expect(isRetryable(599)).toBe(true);
  });
  it("does NOT retry permanent 4xx (except 408 / 429)", () => {
    expect(isRetryable(400)).toBe(false);
    expect(isRetryable(401)).toBe(false);
    expect(isRetryable(404)).toBe(false);
    expect(isRetryable(422)).toBe(false);
  });
  it("does NOT retry successful 2xx", () => {
    expect(isRetryable(200)).toBe(false);
    expect(isRetryable(204)).toBe(false);
  });
});

describe("passesFilter", () => {
  it("treats null / undefined as 'deliver everything'", () => {
    expect(passesFilter(null, "transaction.approved")).toBe(true);
    expect(passesFilter(undefined, "transaction.approved")).toBe(true);
  });
  it("treats non-array as 'deliver everything' (defensive)", () => {
    expect(passesFilter("oops", "transaction.approved")).toBe(true);
    expect(passesFilter(42, "transaction.approved")).toBe(true);
  });
  it("only delivers events explicitly in the filter array", () => {
    const filter = ["transaction.blocked", "escalation.created"];
    expect(passesFilter(filter, "transaction.blocked")).toBe(true);
    expect(passesFilter(filter, "escalation.created")).toBe(true);
    expect(passesFilter(filter, "transaction.approved")).toBe(false);
  });
});

describe("dispatchToWebhook", () => {
  it("sends a single POST on success and stops", async () => {
    const fetchFn = mockFetch({ status: 200 });
    const result = await dispatchToWebhook({
      url: "https://hook.example.com",
      secret: "s",
      payload: PAYLOAD,
      fetchFn,
      backoffMs: [0, 0, 0],
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.attempts).toHaveLength(1);
    expect(result.final.status).toBe(200);
  });

  it("sets the AgentVault headers + JSON body on the request", async () => {
    const fetchFn = mockFetch({ status: 200 });
    await dispatchToWebhook({
      url: "https://hook.example.com",
      secret: "s",
      payload: PAYLOAD,
      fetchFn,
      backoffMs: [0],
      nowSeconds: () => 1748390400,
      deliveryId: "delivery-abc",
    });
    const calls = fetchFn.mock.calls as unknown as Array<[string, RequestInit]>;
    const init = calls[0][1];
    const headers = init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["X-AgentVault-Event"]).toBe("transaction.approved");
    expect(headers["X-AgentVault-Timestamp"]).toBe("1748390400");
    expect(headers["X-AgentVault-Delivery"]).toBe("delivery-abc");
    expect(headers["X-AgentVault-Signature"]).toBe(
      signPayload("s", "1748390400", JSON.stringify(PAYLOAD)),
    );
    expect(init.body).toBe(JSON.stringify(PAYLOAD));
  });

  it("retries on 5xx and succeeds if a later attempt is 2xx", async () => {
    const fetchFn = mockFetch({ status: 503 }, { status: 200 });
    const result = await dispatchToWebhook({
      url: "https://hook.example.com",
      secret: "s",
      payload: PAYLOAD,
      fetchFn,
      backoffMs: [0, 0],
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(result.final.status).toBe(200);
  });

  it("does NOT retry on a permanent 4xx", async () => {
    const fetchFn = mockFetch({ status: 404 });
    const result = await dispatchToWebhook({
      url: "https://hook.example.com",
      secret: "s",
      payload: PAYLOAD,
      fetchFn,
      backoffMs: [0, 0, 0],
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(result.final.status).toBe(404);
  });

  it("treats network errors as retryable and reports the last error", async () => {
    const fetchFn = mockFetch(
      { status: 0, throws: new Error("ECONNRESET") },
      { status: 0, throws: new Error("ETIMEDOUT") },
      { status: 0, throws: new Error("EHOSTUNREACH") },
    );
    const result = await dispatchToWebhook({
      url: "https://hook.example.com",
      secret: "s",
      payload: PAYLOAD,
      fetchFn,
      backoffMs: [0, 0, 0],
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(result.final.status).toBe(0);
    expect(result.final.error).toBe("EHOSTUNREACH");
  });

  it("gives up after the configured number of attempts", async () => {
    const fetchFn = mockFetch({ status: 500 });
    const result = await dispatchToWebhook({
      url: "https://hook.example.com",
      secret: "s",
      payload: PAYLOAD,
      fetchFn,
      backoffMs: [0, 0, 0],
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(result.final.status).toBe(500);
  });
});
