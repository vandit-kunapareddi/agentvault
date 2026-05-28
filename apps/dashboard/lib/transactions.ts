import type { CheckpointStatus, Protocol } from "@agentvault/types";

export interface TransactionRow {
  id: string;
  agentId: string;
  agentName: string;
  vendor: string;
  amount: number;
  status: CheckpointStatus;
  protocol: Protocol;
  trustTier: string | null;
  reason: string | null;
  createdAt: string;
}
