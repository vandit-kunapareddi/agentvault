import type { PaymentReceipt, Protocol } from "@agentvault/types";
import { x402Handler } from "./handlers/x402.js";
import { mppHandler } from "./handlers/mpp.js";
import { acpHandler } from "./handlers/acp.js";
import type { HandlerArgs } from "./handlers/receipt.js";

export class UnsupportedProtocolError extends Error {
  constructor(public readonly protocol: string) {
    super(`Unsupported or undetectable payment protocol: ${protocol}`);
    this.name = "UnsupportedProtocolError";
  }
}

export async function routePayment(
  protocol: Protocol,
  args: HandlerArgs,
): Promise<PaymentReceipt> {
  switch (protocol) {
    case "x402":
      return x402Handler(args);
    case "mpp":
      return mppHandler(args);
    case "acp":
      return acpHandler(args);
    default:
      throw new UnsupportedProtocolError(protocol);
  }
}
