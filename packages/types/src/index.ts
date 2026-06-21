/**
 * Built-in protocols the checkpoint and SDK know about by name. External
 * protocol handlers can register themselves with any string — the union
 * here is just for autocomplete and as documentation of the built-ins.
 * The `(string & {})` widens the type to accept arbitrary strings without
 * collapsing the literal autocomplete suggestions.
 */
export type Protocol =
  | "x402"
  | "mpp"
  | "acp"
  | "unknown"
  | (string & {});

export interface CredentialPayload {
  agentId: string;
  agentName: string;
  walletAddress: string;
  authorizedBy: string;
  dailyCap: number;
  perTxLimit: number;
  approvedVendors: string[];
  /**
   * Optional per-vendor daily spend caps, keyed by vendor hostname. When set,
   * a payment is blocked if today's spend with that specific vendor plus the
   * current amount would exceed the per-vendor limit, independently of the
   * global daily cap. Vendors not present in the map fall back to the global
   * limits.
   */
  vendorLimits?: Record<string, number>;
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

export type CheckpointStatus = "approved" | "blocked" | "escalated" | "recognized";

export interface PaymentReceipt {
  protocol: Protocol;
  receiptId: string;
  vendor: string;
  amount: number;
  currency: "USDC";
  settled: boolean;
  timestamp: string;
}

/**
 * Arguments passed into a protocol handler by the checkpoint router. The
 * pipeline has already run trust + budget + vendor checks by the time a
 * handler is called — the handler's only job is to execute (or simulate)
 * the payment and return a receipt.
 */
export interface HandlerArgs {
  vendor: string;
  amount: number;
  endpoint?: string;
}

/**
 * The contract every protocol handler implements. Returning a receipt with
 * `settled: false` is logged as "recognized" (not approved); throwing is
 * caught by the checkpoint and surfaced as a blocked transaction with the
 * error message as the reason.
 */
export type ProtocolHandler = (args: HandlerArgs) => Promise<PaymentReceipt>;

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
