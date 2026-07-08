/**
 * Masks an email for display so viewers can't read the owner's address.
 * Keeps only the first character of the inbox name and the first character of
 * the domain name, and preserves the top-level domain:
 *
 *   cl@shivamsinghal.me  →  c•@s************.me
 *
 * Non-email strings are masked after the first character as a safe fallback.
 */
export function maskEmail(value: string | null | undefined): string {
  if (!value) return "";

  const at = value.indexOf("@");
  if (at === -1) {
    return value.length <= 1 ? value : value[0] + "•".repeat(value.length - 1);
  }

  const local = value.slice(0, at);
  const domain = value.slice(at + 1);

  const maskedLocal =
    local.length <= 1 ? local : local[0] + "•".repeat(local.length - 1);

  const lastDot = domain.lastIndexOf(".");
  if (lastDot <= 0) {
    const maskedDomain =
      domain.length <= 1 ? domain : domain[0] + "*".repeat(domain.length - 1);
    return `${maskedLocal}@${maskedDomain}`;
  }

  const name = domain.slice(0, lastDot);
  const tld = domain.slice(lastDot); // includes the leading dot, e.g. ".me"
  const maskedName =
    name.length <= 1 ? name : name[0] + "*".repeat(name.length - 1);

  return `${maskedLocal}@${maskedName}${tld}`;
}
