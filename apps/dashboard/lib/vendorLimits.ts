export type VendorLimits = Record<string, number>;

/**
 * Normalises arbitrary input into a clean per-vendor daily limit map. Invalid
 * entries (blank vendor, non-positive amount) are dropped. Returns null when
 * the resulting map is empty, so the column stays NULL in the database.
 */
export function parseVendorLimits(raw: unknown): VendorLimits | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: VendorLimits = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const vendor = String(k).trim().toLowerCase();
    if (!vendor) continue;
    const amount = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    out[vendor] = Math.round(amount * 100) / 100;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Safe read of the JSON column from Prisma into a typed map. Returns an empty
 * object when the column is null or shaped unexpectedly.
 */
export function readVendorLimits(raw: unknown): VendorLimits {
  return parseVendorLimits(raw) ?? {};
}
