import { describe, it, expect } from "vitest";
import {
  buildInsights,
  type InsightAgent,
  type InsightTxRow,
} from "./insights";

const AGENTS: InsightAgent[] = [
  { id: "a1", name: "Research", dailyCap: 20, perTxLimit: 5 },
  { id: "a2", name: "Compute", dailyCap: 30, perTxLimit: 8 },
];

function tx(
  partial: Partial<InsightTxRow> & {
    agentId: string;
    status: string;
    reason: string | null;
  },
): InsightTxRow {
  return {
    vendor: "example.com",
    amount: 1,
    createdAt: new Date(),
    ...partial,
  };
}

describe("buildInsights", () => {
  it("returns no insights when nothing of interest happened", () => {
    expect(
      buildInsights({
        agents: AGENTS,
        transactions: [
          tx({
            agentId: "a1",
            status: "approved",
            reason: null,
            vendor: "exa.ai",
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("surfaces a whitelist insight on a single unlisted-vendor escalation", () => {
    const insights = buildInsights({
      agents: AGENTS,
      transactions: [
        tx({
          agentId: "a1",
          status: "escalated",
          reason: 'Vendor "scraperapi.com" is not on the approved list',
          vendor: "scraperapi.com",
        }),
      ],
    });
    const whitelist = insights.filter((i) => i.type === "whitelist");
    expect(whitelist).toHaveLength(1);
    expect(whitelist[0].vendor).toBe("scraperapi.com");
    expect(whitelist[0].agentName).toBe("Research");
    expect(whitelist[0].count).toBe(1);
  });

  it("escalates a whitelist insight severity to 'warning' at 3+ occurrences", () => {
    const reason = 'Vendor "scraperapi.com" is not on the approved list';
    const insights = buildInsights({
      agents: AGENTS,
      transactions: [
        tx({ agentId: "a1", status: "escalated", reason }),
        tx({ agentId: "a1", status: "escalated", reason }),
        tx({ agentId: "a1", status: "escalated", reason }),
      ],
    });
    const whitelist = insights.find((i) => i.type === "whitelist");
    expect(whitelist?.count).toBe(3);
    expect(whitelist?.severity).toBe("warning");
  });

  it("requires at least 2 per-tx blocks to surface a perTxLimit insight", () => {
    const oneBlock = buildInsights({
      agents: AGENTS,
      transactions: [
        tx({
          agentId: "a1",
          status: "blocked",
          reason: "Amount $7.00 exceeds per-transaction limit $5.00",
        }),
      ],
    });
    expect(oneBlock.filter((i) => i.type === "perTxLimit")).toEqual([]);

    const twoBlocks = buildInsights({
      agents: AGENTS,
      transactions: [
        tx({
          agentId: "a1",
          status: "blocked",
          reason: "Amount $7.00 exceeds per-transaction limit $5.00",
        }),
        tx({
          agentId: "a1",
          status: "blocked",
          reason: "Amount $9.00 exceeds per-transaction limit $5.00",
        }),
      ],
    });
    const perTx = twoBlocks.find((i) => i.type === "perTxLimit");
    expect(perTx).toBeDefined();
    expect(perTx?.count).toBe(2);
    // The "largest attempt" should be the higher of the two attempts.
    expect(perTx?.message).toContain("$9.00");
  });

  it("counts both daily-cap blocks and near-cap escalations toward the dailyCap insight", () => {
    const insights = buildInsights({
      agents: AGENTS,
      transactions: [
        tx({
          agentId: "a1",
          status: "blocked",
          reason:
            "Would exceed daily cap (spent $18.90 + $2.40 > $20.00)",
        }),
        tx({
          agentId: "a1",
          status: "escalated",
          reason:
            "Near daily cap: this would bring spend to $19.50 of $20.00",
        }),
      ],
    });
    const dailyCap = insights.find((i) => i.type === "dailyCap");
    expect(dailyCap?.count).toBe(2);
    expect(dailyCap?.severity).toBe("warning");
  });

  it("bumps dailyCap severity to 'critical' once at 4+ pressure events", () => {
    const reason = "Would exceed daily cap (spent $X + $Y > $20.00)";
    const txs = Array.from({ length: 4 }, () =>
      tx({ agentId: "a1", status: "blocked", reason }),
    );
    const insight = buildInsights({ agents: AGENTS, transactions: txs }).find(
      (i) => i.type === "dailyCap",
    );
    expect(insight?.severity).toBe("critical");
  });

  it("surfaces a vendorLimit insight after 2+ blocks", () => {
    const reason =
      "Vendor limit reached: $1.50 of $2.00 daily limit used for hyperbolic.xyz";
    const insights = buildInsights({
      agents: AGENTS,
      transactions: [
        tx({ agentId: "a2", status: "blocked", reason }),
        tx({ agentId: "a2", status: "blocked", reason }),
      ],
    });
    const vendorLimit = insights.find((i) => i.type === "vendorLimit");
    expect(vendorLimit).toBeDefined();
    expect(vendorLimit?.vendor).toBe("hyperbolic.xyz");
    expect(vendorLimit?.count).toBe(2);
  });

  it("emits a forecast insight when an agent's average pace will exceed cap", () => {
    const insights = buildInsights({
      agents: AGENTS,
      transactions: [],
      forecasts: new Map([
        ["a1", { avgDaily: 25, willExceedCap: true, nearCap: false }],
      ]),
    });
    const forecast = insights.find((i) => i.type === "forecast");
    expect(forecast?.severity).toBe("critical");
    expect(forecast?.message).toContain("$25.00/day");
  });

  it("sorts insights critical → warning → info, then by count desc", () => {
    const reason = "Would exceed daily cap (...)";
    const insights = buildInsights({
      agents: AGENTS,
      transactions: [
        // dailyCap critical (4 events) for a1
        tx({ agentId: "a1", status: "blocked", reason }),
        tx({ agentId: "a1", status: "blocked", reason }),
        tx({ agentId: "a1", status: "blocked", reason }),
        tx({ agentId: "a1", status: "blocked", reason }),
        // whitelist info (1 event) for a2
        tx({
          agentId: "a2",
          status: "escalated",
          reason: 'Vendor "scraperapi.com" is not on the approved list',
        }),
      ],
    });
    expect(insights[0].severity).toBe("critical");
    expect(insights[insights.length - 1].severity).toBe("info");
  });
});
