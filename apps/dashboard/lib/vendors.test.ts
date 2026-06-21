import { describe, it, expect } from "vitest";
import { parseVendorInput, serializeVendors, splitVendors } from "./vendors";

describe("parseVendorInput", () => {
  it("splits on commas and newlines", () => {
    expect(parseVendorInput("a,b\nc")).toEqual(["a", "b", "c"]);
  });
  it("trims whitespace around each entry", () => {
    expect(parseVendorInput("  exa.ai , hyperbolic.xyz \n")).toEqual([
      "exa.ai",
      "hyperbolic.xyz",
    ]);
  });
  it("filters out empty entries", () => {
    expect(parseVendorInput("a,,,\n,b")).toEqual(["a", "b"]);
  });
  it("returns an empty array for empty input", () => {
    expect(parseVendorInput("")).toEqual([]);
    expect(parseVendorInput("   \n  ,  ")).toEqual([]);
  });
});

describe("serializeVendors", () => {
  it("joins with commas", () => {
    expect(serializeVendors(["a", "b", "c"])).toBe("a,b,c");
  });
  it("returns an empty string for empty input", () => {
    expect(serializeVendors([])).toBe("");
  });
});

describe("splitVendors", () => {
  it("splits a comma-joined string back into an array", () => {
    expect(splitVendors("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("trims around entries", () => {
    expect(splitVendors(" a , b ,c")).toEqual(["a", "b", "c"]);
  });
  it("filters out empty entries from a malformed string", () => {
    expect(splitVendors("a,,b,")).toEqual(["a", "b"]);
  });
  it("returns an empty array for an empty string", () => {
    expect(splitVendors("")).toEqual([]);
  });
  it("round-trips with serializeVendors", () => {
    const vendors = ["exa.ai", "hyperbolic.xyz", "coingecko.com"];
    expect(splitVendors(serializeVendors(vendors))).toEqual(vendors);
  });
});
