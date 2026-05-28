import { SimpleTrustProvider, type GateResult, type TrustProvider } from "@agentvault/trust";
import { prisma } from "./db.js";

function getMinScore(): number {
  const raw = Number(process.env.MIN_TRUST_SCORE);
  return Number.isFinite(raw) && raw >= 0 ? raw : 50;
}

const provider: TrustProvider = new SimpleTrustProvider({ minScore: getMinScore() });

export async function gateAgent(
  walletAddress: string,
  agentId: string,
): Promise<GateResult> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  const known =
    !!agent &&
    agent.walletAddress.toLowerCase() === walletAddress.toLowerCase();
  const active = !!agent && !!agent.credential && agent.expiresAt.getTime() > Date.now();

  return provider.gate({ walletAddress, known, active });
}
