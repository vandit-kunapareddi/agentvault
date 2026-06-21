import { describe, it, expect } from "vitest";
import { computeForecast } from "./forecast";

describe("computeForecast", () => {
  it("computes avgDaily as total / windowDays", () => {
    const f = computeForecast({
      recentApprovedAmounts: [7, 7, 7, 7, 7, 7, 7], // $7/day for 7 days
      windowDays: 7,
      dailyCap: 10,
    });
    expect(f.avgDaily).toBe(7);
  });
  it("projects 7d and 30d as avg * window", () => {
    const f = computeForecast({
      recentApprovedAmounts: [2],
      windowDays: 1,
      dailyCap: 10,
    });
    expect(f.projected7d).toBe(14);
    expect(f.projected30d).toBe(60);
  });
  it("flags willExceedCap when avgDaily > dailyCap", () => {
    const f = computeForecast({
      recentApprovedAmounts: [15],
      windowDays: 1,
      dailyCap: 10,
    });
    expect(f.willExceedCap).toBe(true);
    expect(f.nearCap).toBe(false); // avg > cap, so not in [70%, 100%] band
  });
  it("flags nearCap when avgDaily is in [70%, 100%] of dailyCap", () => {
    const f = computeForecast({
      recentApprovedAmounts: [8],
      windowDays: 1,
      dailyCap: 10,
    });
    expect(f.nearCap).toBe(true);
    expect(f.willExceedCap).toBe(false);
  });
  it("does not flag either when avgDaily is well below the cap", () => {
    const f = computeForecast({
      recentApprovedAmounts: [1],
      windowDays: 1,
      dailyCap: 10,
    });
    expect(f.willExceedCap).toBe(false);
    expect(f.nearCap).toBe(false);
  });
  it("treats dailyCap of 0 as no cap (no flags)", () => {
    const f = computeForecast({
      recentApprovedAmounts: [100],
      windowDays: 1,
      dailyCap: 0,
    });
    expect(f.willExceedCap).toBe(false);
    expect(f.nearCap).toBe(false);
  });
  it("returns zero forecasts for an empty window", () => {
    const f = computeForecast({
      recentApprovedAmounts: [],
      windowDays: 7,
      dailyCap: 10,
    });
    expect(f.avgDaily).toBe(0);
    expect(f.projected7d).toBe(0);
    expect(f.projected30d).toBe(0);
  });
});
