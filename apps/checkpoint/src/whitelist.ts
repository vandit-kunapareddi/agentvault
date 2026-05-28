export function isApprovedVendor(vendor: string, approved: string[]): boolean {
  const v = vendor.trim().toLowerCase();
  if (!v) return false;
  return approved.some((a) => a.trim().toLowerCase() === v);
}
