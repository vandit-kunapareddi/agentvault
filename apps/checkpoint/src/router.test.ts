import { afterEach, describe, expect, it } from "vitest";
import {
  listRegisteredProtocols,
  registerHandler,
  routePayment,
  unregisterHandler,
  UnsupportedProtocolError,
  type ProtocolHandler,
} from "./router.js";

const TEST_PROTOCOL = "test-fake-protocol";

afterEach(() => {
  unregisterHandler(TEST_PROTOCOL);
});

describe("protocol handler registry", () => {
  it("auto-registers the built-in handlers (x402, mpp, acp)", () => {
    const registered = listRegisteredProtocols();
    expect(registered).toContain("x402");
    expect(registered).toContain("mpp");
    expect(registered).toContain("acp");
  });

  it("routes to a registered handler with the supplied args", async () => {
    const handler: ProtocolHandler = async (args) => ({
      protocol: "x402",
      receiptId: "test_123",
      vendor: args.vendor,
      amount: args.amount,
      currency: "USDC",
      settled: true,
      timestamp: new Date().toISOString(),
    });
    registerHandler(TEST_PROTOCOL, handler);

    const receipt = await routePayment(TEST_PROTOCOL, {
      vendor: "example.com",
      amount: 0.5,
    });
    expect(receipt.vendor).toBe("example.com");
    expect(receipt.amount).toBe(0.5);
    expect(receipt.receiptId).toBe("test_123");
  });

  it("throws UnsupportedProtocolError for an unknown protocol", async () => {
    await expect(
      routePayment("does-not-exist", { vendor: "v", amount: 1 }),
    ).rejects.toBeInstanceOf(UnsupportedProtocolError);
  });

  it("re-registering replaces the previous handler", async () => {
    const first: ProtocolHandler = async () => ({
      protocol: "x402",
      receiptId: "first",
      vendor: "v",
      amount: 1,
      currency: "USDC",
      settled: true,
      timestamp: new Date().toISOString(),
    });
    const second: ProtocolHandler = async () => ({
      protocol: "x402",
      receiptId: "second",
      vendor: "v",
      amount: 1,
      currency: "USDC",
      settled: true,
      timestamp: new Date().toISOString(),
    });
    registerHandler(TEST_PROTOCOL, first);
    registerHandler(TEST_PROTOCOL, second);

    const receipt = await routePayment(TEST_PROTOCOL, {
      vendor: "v",
      amount: 1,
    });
    expect(receipt.receiptId).toBe("second");
  });

  it("unregisterHandler returns false when the protocol wasn't registered", () => {
    expect(unregisterHandler("never-registered")).toBe(false);
  });

  it("a custom handler that throws is allowed to propagate (callers handle it)", async () => {
    registerHandler(TEST_PROTOCOL, async () => {
      throw new Error("simulated settlement failure");
    });
    await expect(
      routePayment(TEST_PROTOCOL, { vendor: "v", amount: 1 }),
    ).rejects.toThrow("simulated settlement failure");
  });
});
