import crypto from "node:crypto";
import type { Protocol } from "@vanditk2/agentvault-types";
import { prisma } from "./db.js";
import type {
  WebhookEventPayload,
  WebhookEventType,
} from "./events.js";

const SIGNATURE_VERSION = "v0";

// Delay before each delivery attempt in ms. The first attempt fires
// immediately; subsequent retries wait the listed amount.
const DEFAULT_BACKOFF_MS = [0, 1000, 3000];

export interface DeliveryAttempt {
  status: number; // 0 = network error / unreachable
  error?: string;
}

export interface DispatchResult {
  attempts: DeliveryAttempt[];
  final: DeliveryAttempt;
  deliveryId: string;
}

/**
 * Compute the HMAC-SHA-256 signature for a webhook delivery. Mirrors the
 * Slack-style format already used in slack.ts so subscribers can implement
 * verification the same way: hash `${SIGNATURE_VERSION}:${timestamp}:${body}`
 * with the webhook's secret and prefix with the version label.
 */
export function signPayload(
  secret: string,
  timestamp: string,
  body: string,
): string {
  const base = `${SIGNATURE_VERSION}:${timestamp}:${body}`;
  const hmac = crypto.createHmac("sha256", secret).update(base).digest("hex");
  return `${SIGNATURE_VERSION}=${hmac}`;
}

/**
 * Whether a given HTTP status code is worth retrying. Network errors (status
 * 0) and 408/429/5xx are retried; 4xx (except 408/429) are treated as
 * permanent failures and not retried.
 */
export function isRetryable(status: number): boolean {
  if (status === 0) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500 && status < 600;
}

/**
 * Whether a given event passes a webhook's filter. A missing or non-array
 * filter is treated as "deliver everything".
 */
export function passesFilter(
  filter: unknown,
  event: WebhookEventType,
): boolean {
  if (!filter || !Array.isArray(filter)) return true;
  return filter.includes(event);
}

interface DispatchOptions {
  url: string;
  secret: string;
  payload: WebhookEventPayload;
  fetchFn?: typeof fetch;
  /** Override the backoff schedule (in ms) — tests use [0, 0, 0] to run fast. */
  backoffMs?: readonly number[];
  /** Override the timestamp source — tests use this for deterministic signatures. */
  nowSeconds?: () => number;
  /** Override the delivery id — tests use this to assert the header value. */
  deliveryId?: string;
}

/**
 * Deliver a single signed payload to one webhook URL, retrying transient
 * failures up to the configured backoff schedule. Returns every attempt's
 * status so the caller can persist diagnostics — and so tests can assert
 * the retry behaviour.
 */
export async function dispatchToWebhook(
  options: DispatchOptions,
): Promise<DispatchResult> {
  const fetchFn = options.fetchFn ?? fetch;
  const backoff = options.backoffMs ?? DEFAULT_BACKOFF_MS;
  const nowSec = options.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  const deliveryId = options.deliveryId ?? crypto.randomUUID();

  const body = JSON.stringify(options.payload);
  const timestamp = String(nowSec());
  const signature = signPayload(options.secret, timestamp, body);

  const attempts: DeliveryAttempt[] = [];
  for (let i = 0; i < backoff.length; i++) {
    if (backoff[i] > 0) {
      await new Promise((resolve) => setTimeout(resolve, backoff[i]));
    }
    const attempt = await runOnce(
      fetchFn,
      options.url,
      body,
      signature,
      timestamp,
      options.payload.event,
      deliveryId,
    );
    attempts.push(attempt);
    if (attempt.status >= 200 && attempt.status < 300) break;
    if (!isRetryable(attempt.status)) break;
  }
  const final = attempts[attempts.length - 1] ?? {
    status: 0,
    error: "no attempts made",
  };
  return { attempts, final, deliveryId };
}

async function runOnce(
  fetchFn: typeof fetch,
  url: string,
  body: string,
  signature: string,
  timestamp: string,
  event: WebhookEventType,
  deliveryId: string,
): Promise<DeliveryAttempt> {
  try {
    const res = await fetchFn(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-AgentVault-Signature": signature,
        "X-AgentVault-Timestamp": timestamp,
        "X-AgentVault-Event": event,
        "X-AgentVault-Delivery": deliveryId,
      },
      body,
    });
    return { status: res.status };
  } catch (err) {
    return {
      status: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

interface WebhookRow {
  id: string;
  url: string;
  secret: string;
  eventFilter: unknown;
}

/**
 * Public entry point used by the checkpoint pipeline. Loads active webhooks,
 * filters by event type, and fires deliveries fire-and-forget so the main
 * request isn't blocked on outbound HTTP. Errors are logged, never thrown.
 */
export async function emitEvent(
  payload: WebhookEventPayload,
  options: { fetchFn?: typeof fetch } = {},
): Promise<void> {
  let webhooks: WebhookRow[];
  try {
    webhooks = await prisma.webhook.findMany({
      where: { isActive: true },
      select: { id: true, url: true, secret: true, eventFilter: true },
    });
  } catch (err) {
    console.error("[webhooks] failed to load subscriptions", err);
    return;
  }

  for (const webhook of webhooks) {
    if (!passesFilter(webhook.eventFilter, payload.event)) continue;
    void dispatchAndRecord(webhook, payload, options.fetchFn);
  }
}

async function dispatchAndRecord(
  webhook: WebhookRow,
  payload: WebhookEventPayload,
  fetchFn?: typeof fetch,
): Promise<void> {
  try {
    const result = await dispatchToWebhook({
      url: webhook.url,
      secret: webhook.secret,
      payload,
      fetchFn,
    });
    await prisma.webhook.update({
      where: { id: webhook.id },
      data: {
        lastDeliveryAt: new Date(),
        lastDeliveryStatus: result.final.status,
        lastDeliveryError:
          result.final.error ??
          (result.final.status >= 400
            ? `HTTP ${result.final.status}`
            : null),
      },
    });
  } catch (err) {
    console.error(`[webhooks] dispatcher error for ${webhook.id}`, err);
  }
}

// ----- Helpers used by the checkpoint pipeline to emit specific events ----

export async function emitTransactionEvent(
  transactionId: string,
  status: "approved" | "blocked" | "recognized",
): Promise<void> {
  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { agent: { select: { name: true } } },
    });
    if (!tx) return;
    await emitEvent({
      event: `transaction.${status}`,
      deliveredAt: new Date().toISOString(),
      data: {
        transactionId: tx.id,
        agentId: tx.agentId,
        agentName: tx.agent.name,
        vendor: tx.vendor,
        amount: tx.amount,
        protocol: tx.protocol as Protocol,
        trustTier: tx.trustTier,
        status,
        reason: tx.reason,
        createdAt: tx.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[webhooks] emitTransactionEvent failed", err);
  }
}

export async function emitEscalationCreated(
  escalationId: string,
  deadlineMs: number,
): Promise<void> {
  try {
    const esc = await prisma.escalation.findUnique({
      where: { id: escalationId },
      include: { transaction: { include: { agent: { select: { name: true } } } } },
    });
    if (!esc) return;
    await emitEvent({
      event: "escalation.created",
      deliveredAt: new Date().toISOString(),
      data: {
        escalationId: esc.id,
        transactionId: esc.transactionId,
        agentId: esc.transaction.agentId,
        agentName: esc.transaction.agent.name,
        vendor: esc.transaction.vendor,
        amount: esc.transaction.amount,
        reason: esc.transaction.reason,
        createdAt: esc.createdAt.toISOString(),
        deadlineAt: new Date(esc.createdAt.getTime() + deadlineMs).toISOString(),
      },
    });
  } catch (err) {
    console.error("[webhooks] emitEscalationCreated failed", err);
  }
}

export async function emitEscalationResolved(
  escalationId: string,
  decision: "approved" | "blocked",
  resolvedBy: string,
): Promise<void> {
  try {
    const esc = await prisma.escalation.findUnique({
      where: { id: escalationId },
      select: {
        id: true,
        transactionId: true,
        resolvedAt: true,
        transaction: { select: { agentId: true } },
      },
    });
    if (!esc) return;
    await emitEvent({
      event: "escalation.resolved",
      deliveredAt: new Date().toISOString(),
      data: {
        escalationId: esc.id,
        transactionId: esc.transactionId,
        agentId: esc.transaction.agentId,
        decision,
        resolvedBy,
        resolvedAt: (esc.resolvedAt ?? new Date()).toISOString(),
      },
    });
  } catch (err) {
    console.error("[webhooks] emitEscalationResolved failed", err);
  }
}

export async function emitEscalationTimedOut(
  escalationId: string,
): Promise<void> {
  try {
    const esc = await prisma.escalation.findUnique({
      where: { id: escalationId },
      select: {
        id: true,
        transactionId: true,
        transaction: { select: { agentId: true } },
      },
    });
    if (!esc) return;
    await emitEvent({
      event: "escalation.timed_out",
      deliveredAt: new Date().toISOString(),
      data: {
        escalationId: esc.id,
        transactionId: esc.transactionId,
        agentId: esc.transaction.agentId,
        timedOutAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[webhooks] emitEscalationTimedOut failed", err);
  }
}
