import jwt from "jsonwebtoken";
import type { CredentialPayload } from "@agentvault/types";

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET not set");
  return s;
}

export interface SignCredentialInput {
  agentId: string;
  agentName: string;
  authorizedBy: string;
  dailyCap: number;
  perTxLimit: number;
  approvedVendors: string[];
  expiresAt: Date;
}

export function signCredential(input: SignCredentialInput): string {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = Math.floor(input.expiresAt.getTime() / 1000);
  const ttl = expSec - nowSec;
  if (ttl <= 0) {
    throw new Error("expiresAt must be in the future");
  }
  const payload: CredentialPayload = {
    agentId: input.agentId,
    agentName: input.agentName,
    authorizedBy: input.authorizedBy,
    dailyCap: input.dailyCap,
    perTxLimit: input.perTxLimit,
    approvedVendors: input.approvedVendors,
    issuedAt: nowSec,
    expiresAt: expSec,
  };
  return jwt.sign(payload, getSecret(), { expiresIn: ttl });
}
