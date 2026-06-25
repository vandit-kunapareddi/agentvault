import type { EscalationDecision } from "@vanditk2/agentvault-types";
import { prisma } from "./db.js";
import { sendEscalationNotification } from "./slack.js";
import {
  emitEscalationCreated,
  emitEscalationResolved,
  emitEscalationTimedOut,
  emitTransactionEvent,
} from "./webhooks.js";

const DEFAULT_TIMEOUT_MS = 60_000;

function getTimeoutMs(): number {
  const raw = Number(process.env.ESCALATION_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

type Settle = (decision: EscalationDecision) => void;
const pending = new Map<string, Settle>();

export interface HoldArgs {
  agentId: string;
  agentName: string;
  vendor: string;
  amount: number;
  reason: string;
  transactionId: string;
}

export interface HoldResult {
  decision: EscalationDecision;
  escalationId: string;
  timedOut: boolean;
}

export async function holdAndAwait(args: HoldArgs): Promise<HoldResult> {
  const escalation = await prisma.escalation.create({
    data: { transactionId: args.transactionId, status: "pending" },
  });
  const escalationId = escalation.id;

  const timeoutMs = getTimeoutMs();
  void emitEscalationCreated(escalationId, timeoutMs);
  const notified = await sendEscalationNotification({
    escalationId,
    agentName: args.agentName,
    vendor: args.vendor,
    amount: args.amount,
    reason: args.reason,
    timeoutMs,
    dashboardUrl: process.env.DASHBOARD_URL ?? "http://localhost:3000",
  });
  if (notified) {
    await prisma.escalation.update({
      where: { id: escalationId },
      data: { notifiedAt: new Date() },
    });
  }

  const { decision, timedOut } = await new Promise<{
    decision: EscalationDecision;
    timedOut: boolean;
  }>((resolve) => {
    let settled = false;
    const finish = (d: EscalationDecision, t: boolean) => {
      if (settled) return;
      settled = true;
      pending.delete(escalationId);
      resolve({ decision: d, timedOut: t });
    };
    pending.set(escalationId, (d) => finish(d, false));
    setTimeout(() => finish("blocked", true), timeoutMs);
  });

  if (timedOut) {
    await persistTimeout(escalationId);
  }

  return { decision, escalationId, timedOut };
}

export type ResolveResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function resolveEscalation(
  escalationId: string,
  decision: EscalationDecision,
  resolvedBy: string,
): Promise<ResolveResult> {
  const existing = await prisma.escalation.findUnique({
    where: { id: escalationId },
    include: { transaction: true },
  });
  if (!existing) return { ok: false, reason: "Escalation not found" };
  if (existing.status !== "pending") {
    return { ok: false, reason: `Already ${existing.status}` };
  }

  const flag = existing.transaction.reason ?? "flagged for review";
  const resolvedReason =
    decision === "approved"
      ? `Approved after review — ${flag}`
      : `Blocked by reviewer — ${flag}`;

  await prisma.$transaction([
    prisma.escalation.update({
      where: { id: escalationId },
      data: { status: decision, resolvedAt: new Date(), resolvedBy },
    }),
    prisma.transaction.update({
      where: { id: existing.transactionId },
      data: { status: decision, reason: resolvedReason },
    }),
  ]);

  void emitEscalationResolved(escalationId, decision, resolvedBy);
  // The "approved" path will emit transaction.{approved|recognized|blocked}
  // later from finalizeApproved, depending on whether settlement succeeds.
  // The "blocked" path stops here, so emit transaction.blocked now.
  if (decision === "blocked") {
    void emitTransactionEvent(existing.transactionId, "blocked");
  }

  const settle = pending.get(escalationId);
  if (settle) settle(decision);

  return { ok: true };
}

async function persistTimeout(escalationId: string): Promise<void> {
  const existing = await prisma.escalation.findUnique({
    where: { id: escalationId },
    include: { transaction: true },
  });
  if (!existing || existing.status !== "pending") return;
  const flag = existing.transaction.reason ?? "flagged for review";
  await prisma.$transaction([
    prisma.escalation.update({
      where: { id: escalationId },
      data: { status: "timed_out", resolvedAt: new Date() },
    }),
    prisma.transaction.update({
      where: { id: existing.transactionId },
      data: {
        status: "blocked",
        reason: `Auto-blocked — no decision within the escalation window — ${flag}`,
      },
    }),
  ]);
  void emitEscalationTimedOut(escalationId);
  void emitTransactionEvent(existing.transactionId, "blocked");
}
