import type {
  CheckpointRequest,
  CheckpointResponse,
  CheckpointStatus,
  CredentialPayload,
  Protocol,
} from "@agentvault/types";
import { prisma } from "./db.js";
import { verifyCredential } from "./credential.js";
import { getTodaysApprovedSpend } from "./budget.js";
import { isApprovedVendor } from "./whitelist.js";
import { holdAndAwait } from "./escalation.js";
import { gateAgent } from "./trust.js";
import { routePayment, UnsupportedProtocolError } from "./router.js";
import {
  countRecentEscalations,
  getEscalationRateLimit,
  hasUsedVendorBefore,
} from "./heuristics.js";

const NEAR_CAP_THRESHOLD = 0.9;

async function logTransaction(
  agentId: string | null,
  vendor: string,
  amount: number,
  status: CheckpointStatus,
  protocol: Protocol,
  trustTier: string | undefined,
  reason?: string,
): Promise<string | null> {
  if (!agentId) return null;
  try {
    const row = await prisma.transaction.create({
      data: { agentId, vendor, amount, status, protocol, trustTier, reason },
    });
    return row.id;
  } catch (err) {
    console.error("[checkpoint] failed to log transaction", err);
    return null;
  }
}

interface RespondOpts {
  reason?: string;
  protocol?: Protocol;
  trustTier?: string;
  receipt?: CheckpointResponse["receipt"];
}

function respond(status: CheckpointStatus, opts: RespondOpts = {}): CheckpointResponse {
  const res: CheckpointResponse = { status };
  if (opts.reason) res.reason = opts.reason;
  if (opts.protocol) res.protocol = opts.protocol;
  if (opts.trustTier) res.trustTier = opts.trustTier;
  if (opts.receipt) res.receipt = opts.receipt;
  return res;
}

interface FinalizeArgs {
  agentId: string;
  protocol: Protocol;
  vendor: string;
  amount: number;
  endpoint: string | undefined;
  trustTier: string;
  // When resolving an escalation the transaction row already exists; pass its
  // id so we correct (rather than create) its status. Omit for direct approvals.
  transactionId?: string;
}

async function finalizeApproved(args: FinalizeArgs): Promise<CheckpointResponse> {
  const { agentId, protocol, vendor, amount, endpoint, trustTier, transactionId } = args;
  let receipt;
  try {
    receipt = await routePayment(protocol, { vendor, amount, endpoint });
  } catch (err) {
    if (err instanceof UnsupportedProtocolError) {
      return respond("blocked", { protocol, trustTier, reason: err.message });
    }
    throw err;
  }

  const status: CheckpointStatus = receipt.settled ? "approved" : "recognized";
  const reason = receipt.settled
    ? undefined
    : `Protocol "${protocol}" recognized; execution is not yet implemented (not settled)`;

  if (transactionId) {
    // Escalation path: the row exists and was set to "approved" on resolution.
    // Only correct it when settlement didn't actually happen (e.g. ACP).
    if (status !== "approved") {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { status },
      });
    }
  } else {
    await logTransaction(agentId, vendor, amount, status, protocol, trustTier, reason);
  }

  return respond(status, { protocol, trustTier, receipt, reason });
}

async function escalateAndWait(
  payload: CredentialPayload,
  vendor: string,
  amount: number,
  protocol: Protocol,
  trustTier: string,
  endpoint: string | undefined,
  reason: string,
): Promise<CheckpointResponse> {
  const transactionId = await logTransaction(
    payload.agentId,
    vendor,
    amount,
    "escalated",
    protocol,
    trustTier,
    reason,
  );
  if (!transactionId) {
    return respond("blocked", { protocol, trustTier, reason });
  }
  const { decision, timedOut } = await holdAndAwait({
    agentId: payload.agentId,
    agentName: payload.agentName,
    vendor,
    amount,
    reason,
    transactionId,
  });
  if (decision === "approved") {
    return finalizeApproved({
      agentId: payload.agentId,
      protocol,
      vendor,
      amount,
      endpoint,
      trustTier,
      transactionId,
    });
  }
  return respond("blocked", {
    protocol,
    trustTier,
    reason: timedOut
      ? `Auto-blocked: no response within escalation window (${reason})`
      : `Blocked by human reviewer (${reason})`,
  });
}

export async function evaluateCheckpoint(
  req: CheckpointRequest,
): Promise<CheckpointResponse> {
  const vendor = (req.vendor ?? "").trim();
  const amount = req.amount;
  const protocol: Protocol = req.protocol ?? "x402";

  if (!Number.isFinite(amount) || amount <= 0) {
    return respond("blocked", { protocol, reason: "Amount must be a positive number" });
  }
  if (!vendor) {
    return respond("blocked", { protocol, reason: "Vendor is required" });
  }

  const verified = verifyCredential(req.credential);
  if (!verified.ok) {
    return respond("blocked", { protocol, reason: verified.reason });
  }
  const payload = verified.payload;

  const gate = await gateAgent(payload.walletAddress, payload.agentId);
  const trustTier = gate.tier;
  if (!gate.allow) {
    const reason = `Trust check failed: ${gate.reason ?? "below threshold"} (score ${gate.score})`;
    await logTransaction(payload.agentId, vendor, amount, "blocked", protocol, trustTier, reason);
    return respond("blocked", { protocol, trustTier, reason });
  }

  if (protocol === "unknown") {
    const reason =
      "Could not determine a supported payment protocol for this endpoint (supported: x402, mpp, acp)";
    await logTransaction(payload.agentId, vendor, amount, "blocked", protocol, trustTier, reason);
    return respond("blocked", { protocol, trustTier, reason });
  }

  if (amount > payload.perTxLimit) {
    const reason = `Amount $${amount.toFixed(2)} exceeds per-transaction limit $${payload.perTxLimit.toFixed(2)}`;
    await logTransaction(payload.agentId, vendor, amount, "blocked", protocol, trustTier, reason);
    return respond("blocked", { protocol, trustTier, reason });
  }

  if (!isApprovedVendor(vendor, payload.approvedVendors)) {
    const reason = `Vendor "${vendor}" is not on the approved list`;
    return escalateAndWait(payload, vendor, amount, protocol, trustTier, req.endpoint, reason);
  }

  const spent = await getTodaysApprovedSpend(payload.agentId);
  const projected = spent + amount;

  if (projected > payload.dailyCap) {
    const reason = `Would exceed daily cap (spent $${spent.toFixed(2)} + $${amount.toFixed(2)} > $${payload.dailyCap.toFixed(2)})`;
    await logTransaction(payload.agentId, vendor, amount, "blocked", protocol, trustTier, reason);
    return respond("blocked", { protocol, trustTier, reason });
  }

  if (projected / payload.dailyCap >= NEAR_CAP_THRESHOLD) {
    const reason = `Near daily cap: this would bring spend to $${projected.toFixed(2)} of $${payload.dailyCap.toFixed(2)}`;
    return escalateAndWait(payload, vendor, amount, protocol, trustTier, req.endpoint, reason);
  }

  if (!(await hasUsedVendorBefore(payload.agentId, vendor))) {
    const reason = `First payment to "${vendor}" — vendor is approved but this agent has never paid it before`;
    return escalateAndWait(payload, vendor, amount, protocol, trustTier, req.endpoint, reason);
  }

  const recentEscalations = await countRecentEscalations(payload.agentId);
  const rateLimit = getEscalationRateLimit();
  if (recentEscalations >= rateLimit) {
    const reason = `Unusual activity: ${recentEscalations} escalations from this agent in the past hour`;
    return escalateAndWait(payload, vendor, amount, protocol, trustTier, req.endpoint, reason);
  }

  return finalizeApproved({
    agentId: payload.agentId,
    protocol,
    vendor,
    amount,
    endpoint: req.endpoint,
    trustTier,
  });
}
