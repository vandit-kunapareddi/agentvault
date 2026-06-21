import type { PaymentResult, Protocol } from "./types.js";

export type {
  Protocol,
  CheckpointStatus,
  PaymentReceipt,
  CheckpointResponse,
  PaymentResult,
} from "./types.js";

const DEFAULT_CHECKPOINT_URL = "http://localhost:4000";

export interface AgentVaultConfig {
  /** The signed JWT spending credential. Rules live inside it, not here. */
  credential: string;
  /** Base URL of the AgentVault checkpoint. Defaults to http://localhost:4000. */
  checkpointUrl?: string;
}

export interface PayArgs {
  /** The service endpoint the agent wants to pay. */
  endpoint: string;
  /** Maximum amount (USD) the agent is willing to pay for this call. */
  maxAmount: number;
}

/**
 * Detects which agentic payment protocol a service endpoint expects by
 * probing it and reading the X-Payment-Protocol header on a 402 response.
 */
export async function detectProtocol(endpoint: string): Promise<Protocol> {
  try {
    const res = await fetch(endpoint, { method: "GET" });
    if (res.status === 402) {
      const header = res.headers.get("x-payment-protocol");
      if (header === "x402" || header === "mpp" || header === "acp") {
        return header;
      }
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

export class AgentVault {
  constructor(private readonly config: AgentVaultConfig) {}

  /**
   * Pays for a service. Detects the protocol the endpoint expects, then routes
   * the request through the AgentVault checkpoint, which verifies trust,
   * enforces budget rules, escalates if needed, and routes to the protocol.
   */
  async pay(args: PayArgs): Promise<PaymentResult> {
    const protocol = await detectProtocol(args.endpoint);
    let vendor: string;
    try {
      vendor = new URL(args.endpoint).hostname;
    } catch {
      vendor = args.endpoint;
    }

    const baseUrl = this.config.checkpointUrl ?? DEFAULT_CHECKPOINT_URL;
    const res = await fetch(`${baseUrl}/checkpoint`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        credential: this.config.credential,
        vendor,
        amount: args.maxAmount,
        protocol,
        endpoint: args.endpoint,
      }),
    });
    return (await res.json()) as PaymentResult;
  }
}
