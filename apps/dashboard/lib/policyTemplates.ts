export interface PolicyTemplate {
  id: string;
  name: string;
  description: string;
  dailyCap: number;
  perTxLimit: number;
  vendors: string[];
  vendorLimits: Record<string, number>;
}

/**
 * Starting points for the four most common agent shapes. The developer can
 * still edit every field after picking one — the goal is to skip the blank
 * page, not to lock anyone in.
 */
export const POLICY_TEMPLATES: PolicyTemplate[] = [
  {
    id: "research",
    name: "Research Agent",
    description:
      "Reads search and data APIs. Many cheap calls, small per-call amounts.",
    dailyCap: 5.0,
    perTxLimit: 0.5,
    vendors: ["exa.ai", "firecrawl.dev", "coingecko.com", "perplexity.ai"],
    vendorLimits: {
      "exa.ai": 2.0,
      "firecrawl.dev": 1.5,
    },
  },
  {
    id: "compute",
    name: "Compute Agent",
    description:
      "Runs GPU jobs and inference. Fewer, larger payments to compute providers.",
    dailyCap: 25.0,
    perTxLimit: 5.0,
    vendors: ["hyperbolic.xyz", "replicate.com", "modal.com"],
    vendorLimits: {
      "hyperbolic.xyz": 15.0,
    },
  },
  {
    id: "shopping",
    name: "Shopping Agent",
    description:
      "Buys goods or LLM credits on the agent's behalf. Mid-size payments to commerce and model vendors.",
    dailyCap: 50.0,
    perTxLimit: 10.0,
    vendors: ["openai.com", "shopify.com", "stripe.com", "anthropic.com"],
    vendorLimits: {
      "openai.com": 20.0,
      "shopify.com": 25.0,
    },
  },
  {
    id: "financial",
    name: "Financial Agent",
    description:
      "Calls market-data and trading APIs. Higher overall budget, tight per-vendor caps.",
    dailyCap: 100.0,
    perTxLimit: 25.0,
    vendors: ["coingecko.com", "polygon.io", "alpaca.markets"],
    vendorLimits: {
      "polygon.io": 40.0,
      "alpaca.markets": 40.0,
    },
  },
];
