import { afterEach, describe, expect, it, vi } from "vitest";
import { detectProtocol } from "./index";

function mockResponse(status: number, headers: Record<string, string> = {}) {
  const map = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  return {
    status,
    headers: {
      get: (name: string) => map.get(name.toLowerCase()) ?? null,
    },
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("detectProtocol", () => {
  it("returns 'x402' on 402 with x-payment-protocol: x402", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse(402, { "x-payment-protocol": "x402" })),
    );
    expect(await detectProtocol("https://example.com")).toBe("x402");
  });

  it("returns 'mpp' on 402 with x-payment-protocol: mpp", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse(402, { "x-payment-protocol": "mpp" })),
    );
    expect(await detectProtocol("https://example.com")).toBe("mpp");
  });

  it("returns 'acp' on 402 with x-payment-protocol: acp", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse(402, { "x-payment-protocol": "acp" })),
    );
    expect(await detectProtocol("https://example.com")).toBe("acp");
  });

  it("returns 'unknown' on 402 without a known protocol header", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => mockResponse(402, {})));
    expect(await detectProtocol("https://example.com")).toBe("unknown");
  });

  it("returns 'unknown' on a non-402 response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => mockResponse(200)));
    expect(await detectProtocol("https://example.com")).toBe("unknown");
  });

  it("returns 'unknown' when the protocol header is some other string", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => mockResponse(402, { "x-payment-protocol": "btc" })),
    );
    expect(await detectProtocol("https://example.com")).toBe("unknown");
  });

  it("returns 'unknown' on a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );
    expect(await detectProtocol("https://example.com")).toBe("unknown");
  });
});
