import type { PaymentReceipt } from "@vanditk2/agentvault-types";
import { makeReceipt, type HandlerArgs } from "./receipt.js";

// ACP is recognized and routed, but checkout execution (cart, Shared
// Payment Token, fulfillment) is not yet implemented, so the receipt is
// returned unsettled. The control-layer checks still run; only settlement
// is deferred.
export async function acpHandler(args: HandlerArgs): Promise<PaymentReceipt> {
  return makeReceipt("acp", args.vendor, args.amount, false);
}
