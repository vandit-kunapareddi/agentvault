/**
 * Public types for the AgentVault SDK. These mirror the shapes used inside
 * the checkpoint and are inlined here so the published SDK has no internal
 * workspace dependencies.
 */

export type Protocol = "x402" | "mpp" | "acp" | "unknown";

export type CheckpointStatus =
  | "approved"
  | "blocked"
  | "escalated"
  | "recognized";

export interface PaymentReceipt {
  protocol: Protocol;
  receiptId: string;
  vendor: string;
  amount: number;
  currency: "USDC";
  settled: boolean;
  timestamp: string;
}

export interface CheckpointResponse {
  status: CheckpointStatus;
  reason?: string;
  protocol?: Protocol;
  trustTier?: string;
  receipt?: PaymentReceipt;
}

export type PaymentResult = CheckpointResponse;
