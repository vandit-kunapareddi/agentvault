import type { CheckpointStatus } from "@agentvault/types";

export interface TransactionRow {
  id: string;
  agentId: string;
  agentName: string;
  vendor: string;
  amount: number;
  status: CheckpointStatus;
  reason: string | null;
  createdAt: string;
}
