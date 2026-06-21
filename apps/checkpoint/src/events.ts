import type { Protocol } from "@agentvault/types";

/**
 * The full set of events the checkpoint can emit. The taxonomy is
 * `<subject>.<terminal-state>` so subscribers can filter by either the
 * subject (transactions vs escalations) or the specific outcome.
 */
export type WebhookEventType =
  | "transaction.approved"
  | "transaction.blocked"
  | "transaction.recognized"
  | "escalation.created"
  | "escalation.resolved"
  | "escalation.timed_out";

export const ALL_WEBHOOK_EVENT_TYPES: readonly WebhookEventType[] = [
  "transaction.approved",
  "transaction.blocked",
  "transaction.recognized",
  "escalation.created",
  "escalation.resolved",
  "escalation.timed_out",
] as const;

export interface TransactionEventData {
  transactionId: string;
  agentId: string;
  agentName: string;
  vendor: string;
  amount: number;
  protocol: Protocol;
  trustTier: string | null;
  status: "approved" | "blocked" | "recognized";
  reason: string | null;
  createdAt: string;
}

export interface EscalationCreatedData {
  escalationId: string;
  transactionId: string;
  agentId: string;
  agentName: string;
  vendor: string;
  amount: number;
  reason: string | null;
  createdAt: string;
  deadlineAt: string;
}

export interface EscalationResolvedData {
  escalationId: string;
  transactionId: string;
  agentId: string;
  decision: "approved" | "blocked";
  resolvedBy: string | null;
  resolvedAt: string;
}

export interface EscalationTimedOutData {
  escalationId: string;
  transactionId: string;
  agentId: string;
  timedOutAt: string;
}

export type WebhookEventPayload =
  | { event: "transaction.approved"; deliveredAt: string; data: TransactionEventData }
  | { event: "transaction.blocked"; deliveredAt: string; data: TransactionEventData }
  | { event: "transaction.recognized"; deliveredAt: string; data: TransactionEventData }
  | { event: "escalation.created"; deliveredAt: string; data: EscalationCreatedData }
  | { event: "escalation.resolved"; deliveredAt: string; data: EscalationResolvedData }
  | { event: "escalation.timed_out"; deliveredAt: string; data: EscalationTimedOutData };
