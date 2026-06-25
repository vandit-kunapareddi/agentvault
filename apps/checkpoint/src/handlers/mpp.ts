import type { PaymentReceipt } from "@vanditk2/agentvault-types";
import { makeReceipt, type HandlerArgs } from "./receipt.js";

// Stub: routing is real, payment execution is mocked. Returns the same
// receipt shape so swapping in a real MPP session flow is contained.
export async function mppHandler(args: HandlerArgs): Promise<PaymentReceipt> {
  return makeReceipt("mpp", args.vendor, args.amount);
}
