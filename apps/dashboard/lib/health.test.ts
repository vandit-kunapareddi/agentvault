import { describe, it, expect } from "vitest";
import { computeHealth } from "./health";

const base = {
  todayApprovedSpend: 0,
  dailyCap: 100,
  escalationsLastHour: 0,
  blockedLast10Min: 0,
};

describe("computeHealth", () => {
  it("returns 'critical' when today's spend exceeds the daily cap", () => {
    expect(computeHealth({ ...base, todayApprovedSpend: 101 })).toBe("critical");
  });
  it("returns 'critical' when more than 3 escalations in the last hour", () => {
    expect(computeHealth({ ...base, escalationsLastHour: 4 })).toBe("critical");
  });
  it("returns 'critical' when any blocked tx in the last 10 min", () => {
    expect(computeHealth({ ...base, blockedLast10Min: 1 })).toBe("critical");
  });
  it("returns 'warning' when at or above 80% of the daily cap (but at or below 100%)", () => {
    expect(computeHealth({ ...base, todayApprovedSpend: 80 })).toBe("warning");
    expect(computeHealth({ ...base, todayApprovedSpend: 100 })).toBe("warning");
  });
  it("returns 'warning' on >=1 escalation in the last hour (but <=3)", () => {
    expect(computeHealth({ ...base, escalationsLastHour: 1 })).toBe("warning");
    expect(computeHealth({ ...base, escalationsLastHour: 3 })).toBe("warning");
  });
  it("returns 'healthy' for an empty / clean state", () => {
    expect(computeHealth(base)).toBe("healthy");
  });
  it("returns 'healthy' when below all warning thresholds", () => {
    expect(
      computeHealth({ ...base, todayApprovedSpend: 50, escalationsLastHour: 0 }),
    ).toBe("healthy");
  });
  it("treats dailyCap === 0 as no spend pressure (no cap to exceed)", () => {
    expect(
      computeHealth({
        ...base,
        dailyCap: 0,
        todayApprovedSpend: 1000,
      }),
    ).toBe("healthy");
  });
  it("'critical' wins over 'warning' when both apply", () => {
    // Over cap (critical) AND escalations in last hour (warning) → critical
    expect(
      computeHealth({
        ...base,
        todayApprovedSpend: 200,
        escalationsLastHour: 2,
      }),
    ).toBe("critical");
  });
});
