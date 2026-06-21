/**
 * Reference implementation of a custom `ProtocolHandler` for a fictional
 * "ledger-pay" protocol. Records the payment in an external ledger service
 * and returns the entry id as the receipt.
 *
 * Demonstrates the three handler return shapes:
 *   - approved   → return a receipt with `settled: true`
 *   - recognized → return a receipt with `settled: false` (logged distinctly
 *                  in the dashboard, e.g. for ACP-style "I see this but
 *                  haven't actually moved money yet" handlers)
 *   - blocked    → throw — the checkpoint's finalizeApproved catches the
 *                  exception and surfaces it as a blocked transaction with
 *                  the error message as the reason
 *
 * To wire this into the checkpoint, register it at boot. See
 * docs/EXTENDING.md for full instructions:
 *
 *   import { registerHandler } from "./router.js";
 *   import { createLedgerPayHandler } from "@agentvault-examples/protocol-handler";
 *   registerHandler(
 *     "ledger-pay",
 *     createLedgerPayHandler({ ledgerUrl: process.env.LEDGER_URL! }),
 *   );
 */

import type {
  HandlerArgs,
  PaymentReceipt,
  ProtocolHandler,
} from "@agentvault/types";

export interface LedgerPayHandlerOptions {
  /** Base URL of the ledger service. */
  ledgerUrl: string;
  /** Injectable fetch — defaults to the global. Used by tests. */
  fetchFn?: typeof fetch;
}

interface LedgerRecordResponse {
  entryId?: string;
  /** When true, the ledger has acknowledged the entry but settlement happens
   *  asynchronously — we return a `recognized` receipt instead of `approved`. */
  deferred?: boolean;
}

export function createLedgerPayHandler(
  options: LedgerPayHandlerOptions,
): ProtocolHandler {
  const ledgerUrl = options.ledgerUrl.replace(/\/+$/, "");
  const fetchFn = options.fetchFn ?? fetch;

  return async (args: HandlerArgs): Promise<PaymentReceipt> => {
    if (!args.endpoint) {
      throw new Error(
        "ledger-pay handler requires an endpoint to associate the payment with",
      );
    }

    const res = await fetchFn(`${ledgerUrl}/record`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        vendor: args.vendor,
        amount: args.amount,
        endpoint: args.endpoint,
      }),
    });

    if (!res.ok) {
      throw new Error(
        `ledger service rejected the payment: HTTP ${res.status}`,
      );
    }
    const body = (await res.json()) as LedgerRecordResponse;
    if (!body.entryId) {
      throw new Error("ledger service did not return an entryId");
    }

    return {
      protocol: "ledger-pay",
      receiptId: body.entryId,
      vendor: args.vendor,
      amount: args.amount,
      currency: "USDC",
      settled: !body.deferred,
      timestamp: new Date().toISOString(),
    };
  };
}
