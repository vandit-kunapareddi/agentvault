export interface AgentTrustContext {
  walletAddress: string;
  known: boolean;
  active: boolean;
}

export interface GateResult {
  tier: string;
  score: number;
  allow: boolean;
  reason?: string;
}

export interface TrustProvider {
  gate(ctx: AgentTrustContext): Promise<GateResult>;
}

export interface SimpleTrustProviderOptions {
  minScore?: number;
}

const DEFAULT_MIN_SCORE = 50;

export class SimpleTrustProvider implements TrustProvider {
  private readonly minScore: number;

  constructor(options: SimpleTrustProviderOptions = {}) {
    this.minScore = options.minScore ?? DEFAULT_MIN_SCORE;
  }

  async gate(ctx: AgentTrustContext): Promise<GateResult> {
    if (!ctx.known) {
      return {
        tier: "unknown",
        score: 10,
        allow: false,
        reason: "Wallet is not a registered agent",
      };
    }
    if (!ctx.active) {
      const score = 30;
      return {
        tier: "expired",
        score,
        allow: score >= this.minScore,
        reason: "Agent credential is inactive or expired",
      };
    }
    const score = 85;
    return {
      tier: "verified",
      score,
      allow: score >= this.minScore,
      reason: score >= this.minScore ? undefined : "Trust score below required threshold",
    };
  }
}
