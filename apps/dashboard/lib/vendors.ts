export function parseVendorInput(raw: string): string[] {
  return raw
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

export function serializeVendors(vendors: string[]): string {
  return vendors.join(",");
}

export function splitVendors(stored: string): string[] {
  if (!stored) return [];
  return stored
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}
