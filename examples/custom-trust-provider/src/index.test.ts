import { describe, expect, it, vi } from "vitest";
import { ReputationServiceProvider } from "./index";

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

const CTX = { walletAddress: "0xabc", known: true, active: true };

describe("ReputationServiceProvider", () => {
  it("allows when score >= minScore and tags 'verified' at 80+", async () => {
    const provider = new ReputationServiceProvider({
      serviceUrl: "https://rep.example.com",
      minScore: 70,
      fetchFn: mockFetch({ body: { score: 90 } }),
    });
    const result = await provider.gate(CTX);
    expect(result.allow).toBe(true);
    expect(result.tier).toBe("verified");
    expect(result.score).toBe(90);
  });

  it("tags 'probation' when score is in 50–79", async () => {
    const provider = new ReputationServiceProvider({
      serviceUrl: "https://rep.example.com",
      minScore: 50,
      fetchFn: mockFetch({ body: { score: 60 } }),
    });
    const result = await provider.gate(CTX);
    expect(result.tier).toBe("probation");
    expect(result.allow).toBe(true);
  });

  it("blocks (with reason) when score is below the threshold", async () => {
    const provider = new ReputationServiceProvider({
      serviceUrl: "https://rep.example.com",
      minScore: 70,
      fetchFn: mockFetch({ body: { score: 40 } }),
    });
    const result = await provider.gate(CTX);
    expect(result.allow).toBe(false);
    expect(result.tier).toBe("untrusted");
    expect(result.reason).toMatch(/below required threshold/);
  });

  it("blocks on a non-OK HTTP response (never fails open)", async () => {
    const provider = new ReputationServiceProvider({
      serviceUrl: "https://rep.example.com",
      fetchFn: mockFetch({ ok: false, status: 503 }),
    });
    const result = await provider.gate(CTX);
    expect(result.allow).toBe(false);
    expect(result.reason).toContain("HTTP 503");
  });

  it("blocks on a network error (never fails open)", async () => {
    const provider = new ReputationServiceProvider({
      serviceUrl: "https://rep.example.com",
      fetchFn: vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    });
    const result = await provider.gate(CTX);
    expect(result.allow).toBe(false);
    expect(result.reason).toContain("ECONNREFUSED");
  });

  it("blocks when the service returns a non-numeric score", async () => {
    const provider = new ReputationServiceProvider({
      serviceUrl: "https://rep.example.com",
      fetchFn: mockFetch({ body: { score: "not-a-number" } }),
    });
    const result = await provider.gate(CTX);
    expect(result.allow).toBe(false);
    expect(result.reason).toContain("non-numeric");
  });

  it("strips a trailing slash from the service URL", async () => {
    const fetchFn = mockFetch({ body: { score: 90 } });
    const provider = new ReputationServiceProvider({
      serviceUrl: "https://rep.example.com/",
      fetchFn,
    });
    await provider.gate(CTX);
    expect(fetchFn).toHaveBeenCalledWith("https://rep.example.com/score/0xabc");
  });
});
