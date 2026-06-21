import { describe, it, expect } from "vitest";
import { isApprovedVendor } from "./whitelist.js";

describe("isApprovedVendor", () => {
  it("matches case-insensitively", () => {
    expect(isApprovedVendor("Exa.AI", ["exa.ai"])).toBe(true);
    expect(isApprovedVendor("exa.ai", ["Exa.AI"])).toBe(true);
  });
  it("ignores surrounding whitespace on both sides", () => {
    expect(isApprovedVendor("  exa.ai  ", [" exa.ai "])).toBe(true);
  });
  it("returns false for an unlisted vendor", () => {
    expect(isApprovedVendor("scraperapi.com", ["exa.ai", "hyperbolic.xyz"])).toBe(
      false,
    );
  });
  it("returns false for empty input", () => {
    expect(isApprovedVendor("", ["exa.ai"])).toBe(false);
    expect(isApprovedVendor("   ", ["exa.ai"])).toBe(false);
  });
  it("returns false against an empty approved list", () => {
    expect(isApprovedVendor("exa.ai", [])).toBe(false);
  });
});
