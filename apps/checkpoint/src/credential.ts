import jwt from "jsonwebtoken";
import type { CredentialPayload } from "@agentvault/types";

export type VerifyResult =
  | { ok: true; payload: CredentialPayload }
  | { ok: false; reason: string };

export function verifyCredential(token: string | undefined | null): VerifyResult {
  if (!token) return { ok: false, reason: "Missing credential" };
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return { ok: false, reason: "Server misconfigured: JWT_SECRET unset" };
  }
  try {
    const payload = jwt.verify(token, secret) as CredentialPayload;
    return { ok: true, payload };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return { ok: false, reason: "Credential expired" };
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return { ok: false, reason: "Invalid credential signature" };
    }
    return { ok: false, reason: "Credential verification failed" };
  }
}
