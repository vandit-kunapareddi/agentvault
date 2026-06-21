import { describe, it, expect } from "vitest";
import { makeReceipt } from "./receipt.js";

describe("makeReceipt", () => {
  it("returns a receipt with the supplied protocol / vendor / amount", () => {
    const r = makeReceipt("x402", "exa.ai", 0.05);
    expect(r.protocol).toBe("x402");
    expect(r.vendor).toBe("exa.ai");
    expect(r.amount).toBe(0.05);
  });
  it("defaults settled to true", () => {
    expect(makeReceipt("x402", "exa.ai", 0.05).settled).toBe(true);
  });
  it("respects explicit settled=false (for ACP-style recognized but not executed)", () => {
    expect(makeReceipt("acp", "shopify.com", 1.0, false).settled).toBe(false);
  });
  it("always uses USDC as the currency", () => {
    expect(makeReceipt("x402", "exa.ai", 0.05).currency).toBe("USDC");
  });
  it("generates a receiptId prefixed with the protocol", () => {
    expect(makeReceipt("x402", "exa.ai", 0.05).receiptId).toMatch(/^x402_/);
    expect(makeReceipt("mpp", "exa.ai", 0.05).receiptId).toMatch(/^mpp_/);
    expect(makeReceipt("acp", "exa.ai", 0.05).receiptId).toMatch(/^acp_/);
  });
  it("uses 'pay_' prefix for the 'unknown' protocol", () => {
    expect(makeReceipt("unknown", "exa.ai", 0.05).receiptId).toMatch(/^pay_/);
  });
  it("emits an ISO-8601 timestamp", () => {
    const r = makeReceipt("x402", "exa.ai", 0.05);
    expect(() => new Date(r.timestamp).toISOString()).not.toThrow();
    expect(r.timestamp).toBe(new Date(r.timestamp).toISOString());
  });
});
