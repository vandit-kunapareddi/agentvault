import { describe, it, expect } from "vitest";
import { parseVendorLimits, readVendorLimits } from "./vendorLimits";

describe("parseVendorLimits", () => {
  it("normalises vendor keys to lowercase + trimmed", () => {
    expect(parseVendorLimits({ "  Exa.AI  ": 2 })).toEqual({ "exa.ai": 2 });
  });
  it("rounds amounts to 2 decimal places", () => {
    expect(parseVendorLimits({ "exa.ai": 1.239 })).toEqual({ "exa.ai": 1.24 });
  });
  it("accepts numeric strings", () => {
    expect(parseVendorLimits({ "exa.ai": "1.5" })).toEqual({ "exa.ai": 1.5 });
  });
  it("drops entries with non-positive amounts", () => {
    expect(parseVendorLimits({ a: 1, b: 0, c: -5 })).toEqual({ a: 1 });
  });
  it("drops entries with non-numeric amounts", () => {
    expect(parseVendorLimits({ a: 1, b: "nope" })).toEqual({ a: 1 });
  });
  it("drops entries with blank vendor keys", () => {
    expect(parseVendorLimits({ "": 1, "  ": 2, ok: 3 })).toEqual({ ok: 3 });
  });
  it("returns null when input is not an object", () => {
    expect(parseVendorLimits(null)).toBeNull();
    expect(parseVendorLimits(undefined)).toBeNull();
    expect(parseVendorLimits("string")).toBeNull();
    expect(parseVendorLimits(42)).toBeNull();
    expect(parseVendorLimits([])).toBeNull();
  });
  it("returns null when the cleaned map is empty", () => {
    expect(parseVendorLimits({ a: 0, b: -1 })).toBeNull();
    expect(parseVendorLimits({})).toBeNull();
  });
});

describe("readVendorLimits", () => {
  it("returns the parsed map when valid", () => {
    expect(readVendorLimits({ "exa.ai": 2 })).toEqual({ "exa.ai": 2 });
  });
  it("returns an empty object when input is invalid (vs null)", () => {
    expect(readVendorLimits(null)).toEqual({});
    expect(readVendorLimits("nope")).toEqual({});
  });
});
