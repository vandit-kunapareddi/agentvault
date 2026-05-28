import type { PaymentReceipt, Protocol } from "@agentvault/types";

export function makeReceipt(
  protocol: Protocol,
  vendor: string,
  amount: number,
): PaymentReceipt {
  const prefix = protocol === "unknown" ? "pay" : protocol;
  return {
    protocol,
    receiptId: `${prefix}_${Math.random().toString(36).slice(2, 10)}`,
    vendor,
    amount,
    currency: "USDC",
    settled: true,
    timestamp: new Date().toISOString(),
  };
}

export interface HandlerArgs {
  vendor: string;
  amount: number;
  endpoint?: string;
}
