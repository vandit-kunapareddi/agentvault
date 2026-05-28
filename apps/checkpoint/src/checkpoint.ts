import type {
  CheckpointRequest,
  CheckpointResponse,
  CheckpointStatus,
} from "@agentvault/types";
import { prisma } from "./db.js";
import { verifyCredential } from "./credential.js";
import { getTodaysApprovedSpend } from "./budget.js";
import { isApprovedVendor } from "./whitelist.js";

const NEAR_CAP_THRESHOLD = 0.9;

async function logTransaction(
  agentId: string | null,
  vendor: string,
  amount: number,
  status: CheckpointStatus,
  reason?: string,
): Promise<void> {
  if (!agentId) return;
  try {
    await prisma.transaction.create({
      data: { agentId, vendor, amount, status, reason },
    });
  } catch (err) {
    console.error("[checkpoint] failed to log transaction", err);
  }
}

function respond(status: CheckpointStatus, reason?: string): CheckpointResponse {
  return reason ? { status, reason } : { status };
}

export async function evaluateCheckpoint(
  req: CheckpointRequest,
): Promise<CheckpointResponse> {
  const vendor = (req.vendor ?? "").trim();
  const amount = req.amount;

  if (!Number.isFinite(amount) || amount <= 0) {
    return respond("blocked", "Amount must be a positive number");
  }
  if (!vendor) {
    return respond("blocked", "Vendor is required");
  }

  const verified = verifyCredential(req.credential);
  if (!verified.ok) {
    return respond("blocked", verified.reason);
  }
  const payload = verified.payload;

  if (amount > payload.perTxLimit) {
    const reason = `Amount $${amount.toFixed(2)} exceeds per-transaction limit $${payload.perTxLimit.toFixed(2)}`;
    await logTransaction(payload.agentId, vendor, amount, "blocked", reason);
    return respond("blocked", reason);
  }

  if (!isApprovedVendor(vendor, payload.approvedVendors)) {
    const reason = `Vendor "${vendor}" is not on the approved list`;
    await logTransaction(payload.agentId, vendor, amount, "escalated", reason);
    return respond("escalated", reason);
  }

  const spent = await getTodaysApprovedSpend(payload.agentId);
  const projected = spent + amount;

  if (projected > payload.dailyCap) {
    const reason = `Would exceed daily cap (spent $${spent.toFixed(2)} + $${amount.toFixed(2)} > $${payload.dailyCap.toFixed(2)})`;
    await logTransaction(payload.agentId, vendor, amount, "blocked", reason);
    return respond("blocked", reason);
  }

  if (projected / payload.dailyCap >= NEAR_CAP_THRESHOLD) {
    const reason = `Near daily cap: this would bring spend to $${projected.toFixed(2)} of $${payload.dailyCap.toFixed(2)}`;
    await logTransaction(payload.agentId, vendor, amount, "escalated", reason);
    return respond("escalated", reason);
  }

  await logTransaction(payload.agentId, vendor, amount, "approved");
  return respond("approved");
}
