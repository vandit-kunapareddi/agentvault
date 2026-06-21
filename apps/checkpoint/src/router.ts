import type { HandlerArgs, PaymentReceipt, ProtocolHandler } from "@agentvault/types";
import { x402Handler } from "./handlers/x402.js";
import { mppHandler } from "./handlers/mpp.js";
import { acpHandler } from "./handlers/acp.js";

// Re-export the public extension contract so callers can import it from a
// single place. The canonical definition lives in @agentvault/types.
export type { ProtocolHandler, HandlerArgs };

export class UnsupportedProtocolError extends Error {
  constructor(public readonly protocol: string) {
    super(`Unsupported or undetectable payment protocol: ${protocol}`);
    this.name = "UnsupportedProtocolError";
  }
}

const registry = new Map<string, ProtocolHandler>();

/**
 * Register a protocol handler. Built-in handlers (x402 / mpp / acp) register
 * themselves at module load — external packages can call this to add a new
 * protocol (e.g. ap2, tap) without forking the checkpoint, or to override a
 * built-in mock with a real implementation. Re-registering an existing
 * protocol replaces the previous handler.
 */
export function registerHandler(
  protocol: string,
  handler: ProtocolHandler,
): void {
  registry.set(protocol, handler);
}

/**
 * Remove a previously registered handler. Mostly useful in tests.
 */
export function unregisterHandler(protocol: string): boolean {
  return registry.delete(protocol);
}

/**
 * The protocols currently registered, in insertion order. Useful for a
 * `/protocols` debug endpoint or for sanity-checking that a custom handler
 * loaded as expected.
 */
export function listRegisteredProtocols(): string[] {
  return Array.from(registry.keys());
}

export async function routePayment(
  protocol: string,
  args: HandlerArgs,
): Promise<PaymentReceipt> {
  const handler = registry.get(protocol);
  if (!handler) throw new UnsupportedProtocolError(protocol);
  return handler(args);
}

// Built-in handlers self-register at module load. Importing this file
// guarantees x402, mpp, and acp are routable.
registerHandler("x402", x402Handler);
registerHandler("mpp", mppHandler);
registerHandler("acp", acpHandler);
