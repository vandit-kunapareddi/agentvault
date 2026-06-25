/**
 * Reference implementation of a custom `TrustProvider` that delegates
 * scoring to an external reputation service over HTTP.
 *
 * Demonstrates:
 *  - The `TrustProvider` interface end-to-end (constructor → gate())
 *  - The **never-fail-open** principle: every error path returns
 *    `allow: false` with a clear reason, never a default-allow
 *  - Injectable `fetch` so the unit tests don't need a network
 *
 * To wire this into the checkpoint, swap `SimpleTrustProvider` in
 * apps/checkpoint/src/trust.ts for this class. See docs/EXTENDING.md.
 */

import type {
  AgentTrustContext,
  GateResult,
  TrustProvider,
} from "@vanditk2/agentvault-trust";

export interface ReputationServiceOptions {
  /** Base URL of the reputation service (e.g. https://reputation.example.com). */
  serviceUrl: string;
  /** Minimum score (0–100) the agent must clear to be allowed. Defaults to 70. */
  minScore?: number;
  /** Injectable fetch — defaults to the global. Used by tests. */
  fetchFn?: typeof fetch;
}

interface ReputationResponse {
  score?: unknown;
}

export class ReputationServiceProvider implements TrustProvider {
  private readonly serviceUrl: string;
  private readonly minScore: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: ReputationServiceOptions) {
    this.serviceUrl = options.serviceUrl.replace(/\/+$/, "");
    this.minScore = options.minScore ?? 70;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async gate(ctx: AgentTrustContext): Promise<GateResult> {
    let score: number;
    try {
      const res = await this.fetchFn(
        `${this.serviceUrl}/score/${encodeURIComponent(ctx.walletAddress)}`,
      );
      if (!res.ok) {
        return block(`Reputation service returned HTTP ${res.status}`);
      }
      const body = (await res.json()) as ReputationResponse;
      const raw =
        typeof body.score === "number" ? body.score : Number(body.score);
      if (!Number.isFinite(raw)) {
        return block("Reputation service returned a non-numeric score");
      }
      score = raw;
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return block(`Reputation service unreachable: ${detail}`);
    }

    return {
      tier:
        score >= 80 ? "verified" : score >= 50 ? "probation" : "untrusted",
      score,
      allow: score >= this.minScore,
      reason:
        score < this.minScore
          ? `Reputation score ${score} below required threshold ${this.minScore}`
          : undefined,
    };
  }
}

// Single source of truth for the "blocked, with reason" shape so every error
// path looks the same — never fail open.
function block(reason: string): GateResult {
  return { tier: "unknown", score: 0, allow: false, reason };
}
