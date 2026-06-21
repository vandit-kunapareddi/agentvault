import type { PaymentReceipt, Protocol } from "@agentvault/types";

// HandlerArgs lives in @agentvault/types so external protocol handlers can
// import it without depending on the checkpoint's internal layout. Re-exported
// here for backwards-compatibility with existing internal imports.
export type { HandlerArgs } from "@agentvault/types";

export function makeReceipt(
  protocol: Protocol,
  vendor: string,
  amount: number,
  settled = true,
): PaymentReceipt {
  const prefix = protocol === "unknown" ? "pay" : protocol;
  return {
    protocol,
    receiptId: `${prefix}_${Math.random().toString(36).slice(2, 10)}`,
    vendor,
    amount,
    currency: "USDC",
    settled,
    timestamp: new Date().toISOString(),
  };
}
