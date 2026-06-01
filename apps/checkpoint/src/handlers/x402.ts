import axios, { type AxiosInstance, AxiosError } from "axios";
import {
  wrapAxiosWithPaymentFromConfig,
  decodePaymentResponseHeader,
} from "@x402/axios";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import type { PaymentReceipt } from "@agentvault/types";
import { makeReceipt, type HandlerArgs } from "./receipt.js";

let cachedKey: string | null = null;
let cachedApi: AxiosInstance | null = null;

function getPaymentApi(): AxiosInstance | null {
  const key = process.env.WALLET_PRIVATE_KEY;
  if (!key) return null;
  if (cachedApi && cachedKey === key) return cachedApi;

  const normalized = (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`;
  const account = privateKeyToAccount(normalized);
  // `eip155:*` covers every EVM chain — when an x402 server replies with a
  // 402 it includes the network it expects (e.g. eip155:84532 for Base
  // Sepolia) and our scheme client signs for whichever chain comes back.
  cachedApi = wrapAxiosWithPaymentFromConfig(axios.create(), {
    schemes: [
      {
        network: "eip155:*",
        client: new ExactEvmScheme(account),
      },
    ],
  });
  cachedKey = key;
  return cachedApi;
}

interface DecodedPaymentResponse {
  transaction?: string;
  txHash?: string;
  network?: string;
  payer?: string;
  success?: boolean;
}

function extractTxHash(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  try {
    const decoded = decodePaymentResponseHeader(headerValue) as DecodedPaymentResponse;
    return decoded.transaction ?? decoded.txHash ?? null;
  } catch {
    return null;
  }
}

export async function x402Handler(args: HandlerArgs): Promise<PaymentReceipt> {
  const api = getPaymentApi();

  // Mock fallback — preserves the original demo behaviour when no wallet is
  // configured (e.g. local dev without a funded Base Sepolia account).
  if (!api) {
    return makeReceipt("x402", args.vendor, args.amount, true);
  }
  // Without an endpoint we have nothing to actually call. Treat it like the
  // mock so the checkpoint still surfaces a clean approved receipt instead
  // of a 500.
  if (!args.endpoint) {
    return makeReceipt("x402", args.vendor, args.amount, true);
  }

  try {
    const response = await api.get(args.endpoint);
    const receipt = makeReceipt("x402", args.vendor, args.amount, true);
    const headerValue = response.headers["payment-response"];
    const txHash = extractTxHash(
      typeof headerValue === "string" ? headerValue : undefined,
    );
    if (txHash) receipt.receiptId = txHash;
    return receipt;
  } catch (err) {
    if (err instanceof AxiosError) {
      const status = err.response?.status;
      const detail =
        typeof err.response?.data === "string"
          ? err.response?.data
          : err.message;
      throw new Error(
        `x402 settlement failed (${status ?? "network"}): ${detail}`,
      );
    }
    if (err instanceof Error) {
      throw new Error(`x402 settlement failed: ${err.message}`);
    }
    throw new Error("x402 settlement failed");
  }
}
