import { describe, expect, it, vi } from "vitest";
import { createLedgerPayHandler } from "./index";

function mockFetch(response: {
  ok?: boolean;
  status?: number;
  body?: unknown;
}) {
  return vi.fn(
    async () =>
      ({
        ok: response.ok ?? true,
        status: response.status ?? 200,
        json: async () => response.body ?? {},
      }) as unknown as Response,
  );
}

const ARGS = {
  vendor: "exa.ai",
  amount: 0.05,
  endpoint: "https://api.exa.ai/search",
};

describe("createLedgerPayHandler", () => {
  it("returns a settled receipt on success", async () => {
    const handler = createLedgerPayHandler({
      ledgerUrl: "https://ledger.example.com",
      fetchFn: mockFetch({ body: { entryId: "led_abc123" } }),
    });
    const receipt = await handler(ARGS);
    expect(receipt.protocol).toBe("ledger-pay");
    expect(receipt.receiptId).toBe("led_abc123");
    expect(receipt.vendor).toBe("exa.ai");
    expect(receipt.amount).toBe(0.05);
    expect(receipt.settled).toBe(true);
  });

  it("returns a recognized (settled: false) receipt when the ledger defers settlement", async () => {
    const handler = createLedgerPayHandler({
      ledgerUrl: "https://ledger.example.com",
      fetchFn: mockFetch({ body: { entryId: "led_xyz", deferred: true } }),
    });
    const receipt = await handler(ARGS);
    expect(receipt.settled).toBe(false);
  });

  it("throws when the ledger returns a non-OK status (caller will surface as blocked)", async () => {
    const handler = createLedgerPayHandler({
      ledgerUrl: "https://ledger.example.com",
      fetchFn: mockFetch({ ok: false, status: 502 }),
    });
    await expect(handler(ARGS)).rejects.toThrow(/HTTP 502/);
  });

  it("throws when the ledger response is missing entryId", async () => {
    const handler = createLedgerPayHandler({
      ledgerUrl: "https://ledger.example.com",
      fetchFn: mockFetch({ body: { somethingElse: true } }),
    });
    await expect(handler(ARGS)).rejects.toThrow(/did not return an entryId/);
  });

  it("throws when no endpoint is supplied (we can't record what we can't identify)", async () => {
    const handler = createLedgerPayHandler({
      ledgerUrl: "https://ledger.example.com",
      fetchFn: vi.fn(),
    });
    await expect(handler({ vendor: "exa.ai", amount: 0.05 })).rejects.toThrow(
      /requires an endpoint/,
    );
  });

  it("propagates network errors (caller will surface as blocked)", async () => {
    const handler = createLedgerPayHandler({
      ledgerUrl: "https://ledger.example.com",
      fetchFn: vi.fn(async () => {
        throw new Error("ECONNRESET");
      }),
    });
    await expect(handler(ARGS)).rejects.toThrow("ECONNRESET");
  });

  it("strips a trailing slash from the ledger URL", async () => {
    const fetchFn = mockFetch({ body: { entryId: "ok" } });
    const handler = createLedgerPayHandler({
      ledgerUrl: "https://ledger.example.com/",
      fetchFn,
    });
    await handler(ARGS);
    expect(fetchFn).toHaveBeenCalledWith(
      "https://ledger.example.com/record",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
