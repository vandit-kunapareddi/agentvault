export type Protocol = "x402" | "mpp" | "acp" | "unknown";

export interface CredentialPayload {
  agentId: string;
  agentName: string;
  walletAddress: string;
  authorizedBy: string;
  dailyCap: number;
  perTxLimit: number;
  approvedVendors: string[];
  supportedProtocols: Protocol[];
  issuedAt: number;
  expiresAt: number;
}

export interface CheckpointRequest {
  credential: string;
  vendor: string;
  amount: number;
  protocol?: Protocol;
  endpoint?: string;
}

export type CheckpointStatus = "approved" | "blocked" | "escalated";

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

export interface MockPaymentRequest {
  amount: number;
  agentId?: string;
}

export interface MockPaymentResponse {
  receiptId: string;
  vendor: string;
  amount: number;
  currency: "USDC";
  timestamp: string;
}

export type EscalationStatus = "pending" | "approved" | "blocked" | "timed_out";

export type EscalationDecision = "approved" | "blocked";

export interface EscalationRow {
  id: string;
  transactionId: string;
  agentId: string;
  agentName: string;
  vendor: string;
  amount: number;
  reason: string | null;
  status: EscalationStatus;
  notifiedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
  deadlineAt: string | null;
}

export interface ResolveEscalationRequest {
  decision: EscalationDecision;
  resolvedBy?: string;
}
