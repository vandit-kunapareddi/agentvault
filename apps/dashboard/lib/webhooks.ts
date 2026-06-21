/**
 * Validation + sanitisation helpers for the /api/webhooks routes.
 *
 * NOTE: KNOWN_EVENT_TYPES must stay in sync with ALL_WEBHOOK_EVENT_TYPES
 * in apps/checkpoint/src/events.ts. If we ever extract that into a shared
 * package, both copies should be deleted in favour of the shared one.
 */

export const KNOWN_EVENT_TYPES = [
  "transaction.approved",
  "transaction.blocked",
  "transaction.recognized",
  "escalation.created",
  "escalation.resolved",
  "escalation.timed_out",
] as const;

export type KnownEventType = (typeof KNOWN_EVENT_TYPES)[number];

export interface WebhookRecord {
  id: string;
  url: string;
  secret: string;
  description: string | null;
  eventFilter: unknown;
  isActive: boolean;
  createdAt: Date | string;
  lastDeliveryAt: Date | string | null;
  lastDeliveryStatus: number | null;
  lastDeliveryError: string | null;
}

/**
 * Strip the secret from a webhook record before returning it to the client.
 * The secret is only revealed once, in the response body of POST /api/webhooks.
 */
export function sanitizeWebhook(w: WebhookRecord) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { secret: _secret, ...rest } = w;
  return rest;
}

export interface ValidatedWebhookInput {
  url?: string;
  description?: string | null;
  eventFilter?: KnownEventType[] | null;
  isActive?: boolean;
}

export type ValidationResult =
  | { ok: true; value: ValidatedWebhookInput }
  | { ok: false; error: string };

interface RawInput {
  url?: unknown;
  description?: unknown;
  eventFilter?: unknown;
  isActive?: unknown;
}

export function validateWebhookInput(
  raw: unknown,
  opts: { requireUrl: boolean },
): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const body = raw as RawInput;
  const out: ValidatedWebhookInput = {};

  if (body.url !== undefined) {
    if (typeof body.url !== "string" || body.url.trim().length === 0) {
      return { ok: false, error: "url must be a non-empty string" };
    }
    let parsed: URL;
    try {
      parsed = new URL(body.url.trim());
    } catch {
      return { ok: false, error: "url is not a valid URL" };
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { ok: false, error: "url must use http or https" };
    }
    out.url = parsed.toString();
  } else if (opts.requireUrl) {
    return { ok: false, error: "url is required" };
  }

  if (body.description !== undefined) {
    if (body.description === null) {
      out.description = null;
    } else if (typeof body.description !== "string") {
      return { ok: false, error: "description must be a string or null" };
    } else {
      const trimmed = body.description.trim();
      out.description = trimmed.length > 0 ? trimmed.slice(0, 200) : null;
    }
  }

  if (body.eventFilter !== undefined) {
    if (body.eventFilter === null) {
      out.eventFilter = null;
    } else if (!Array.isArray(body.eventFilter)) {
      return { ok: false, error: "eventFilter must be an array or null" };
    } else {
      const cleaned: KnownEventType[] = [];
      const seen = new Set<string>();
      for (const entry of body.eventFilter) {
        if (typeof entry !== "string") {
          return { ok: false, error: "eventFilter entries must be strings" };
        }
        if (!(KNOWN_EVENT_TYPES as readonly string[]).includes(entry)) {
          return { ok: false, error: `Unknown event type: ${entry}` };
        }
        if (!seen.has(entry)) {
          cleaned.push(entry as KnownEventType);
          seen.add(entry);
        }
      }
      // An empty array would deliver nothing — treat that as "no filter".
      out.eventFilter = cleaned.length > 0 ? cleaned : null;
    }
  }

  if (body.isActive !== undefined) {
    if (typeof body.isActive !== "boolean") {
      return { ok: false, error: "isActive must be a boolean" };
    }
    out.isActive = body.isActive;
  }

  return { ok: true, value: out };
}
