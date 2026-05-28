import type { PaymentReceipt } from "@agentvault/types";
import { makeReceipt, type HandlerArgs } from "./receipt.js";

// Stub: routing is real, payment execution is mocked. Returns the same
// receipt shape so swapping in a real ACP checkout flow is contained.
export async function acpHandler(args: HandlerArgs): Promise<PaymentReceipt> {
  return makeReceipt("acp", args.vendor, args.amount);
}
