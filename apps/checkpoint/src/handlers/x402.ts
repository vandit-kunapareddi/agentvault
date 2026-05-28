import type { PaymentReceipt } from "@agentvault/types";
import { makeReceipt, type HandlerArgs } from "./receipt.js";

export async function x402Handler(args: HandlerArgs): Promise<PaymentReceipt> {
  return makeReceipt("x402", args.vendor, args.amount);
}
