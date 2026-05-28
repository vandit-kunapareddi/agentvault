export interface CredentialPayload {
  agentId: string;
  agentName: string;
  authorizedBy: string;
  dailyCap: number;
  perTxLimit: number;
  approvedVendors: string[];
  issuedAt: number;
  expiresAt: number;
}

export interface CheckpointRequest {
  credential: string;
  vendor: string;
  amount: number;
}

export type CheckpointStatus = "approved" | "blocked" | "escalated";

export interface CheckpointResponse {
  status: CheckpointStatus;
  reason?: string;
}

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
