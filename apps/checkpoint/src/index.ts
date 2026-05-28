import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import express, { type Request, type Response } from "express";
import type {
  CheckpointRequest,
  CheckpointResponse,
  EscalationDecision,
  ResolveEscalationRequest,
} from "@agentvault/types";
import { evaluateCheckpoint } from "./checkpoint.js";
import { mockX402 } from "./mock-x402.js";
import { mockServices } from "./mock-services.js";
import { prisma } from "./db.js";
import { resolveEscalation } from "./escalation.js";
import { resolvedSlackMessage, verifySlackSignature } from "./slack.js";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../../.env") });

const PORT = Number(process.env.PORT ?? process.env.CHECKPOINT_PORT ?? 4000);

const app = express();

// Slack interactivity endpoint: must read raw body for HMAC verification
app.post(
  "/slack/interactivity",
  express.raw({ type: "application/x-www-form-urlencoded" }),
  async (req: Request, res: Response) => {
    const rawBody = (req.body as Buffer | undefined)?.toString("utf8") ?? "";
    const timestamp = req.header("x-slack-request-timestamp") ?? undefined;
    const signature = req.header("x-slack-signature") ?? undefined;

    const verification = verifySlackSignature(rawBody, timestamp, signature);
    if (!verification.ok) {
      console.warn(`[slack] rejected interactivity: ${verification.reason}`);
      res.status(401).json({ error: verification.reason });
      return;
    }

    const params = new URLSearchParams(rawBody);
    const payloadRaw = params.get("payload");
    if (!payloadRaw) {
      res.status(400).json({ error: "Missing payload" });
      return;
    }
    let payload: unknown;
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      res.status(400).json({ error: "Invalid payload JSON" });
      return;
    }

    const p = payload as {
      actions?: Array<{ action_id?: string; value?: string }>;
      user?: { id?: string; username?: string };
    };
    const action = p.actions?.[0];
    if (
      !action ||
      (action.action_id !== "approve" && action.action_id !== "block") ||
      typeof action.value !== "string"
    ) {
      res.status(400).json({ error: "Unexpected action payload" });
      return;
    }
    const decision: EscalationDecision =
      action.action_id === "approve" ? "approved" : "blocked";
    const slackUser =
      p.user?.username ?? p.user?.id ?? "unknown";
    const resolvedBy = `slack:${slackUser}`;

    const before = await prisma.escalation.findUnique({
      where: { id: action.value },
      include: { transaction: { include: { agent: true } } },
    });
    const result = await resolveEscalation(action.value, decision, resolvedBy);
    if (!result.ok) {
      res
        .status(409)
        .json({ replace_original: false, text: `Cannot resolve: ${result.reason}` });
      return;
    }

    const agentName = before?.transaction.agent.name ?? "agent";
    const vendor = before?.transaction.vendor ?? "vendor";
    const amount = before?.transaction.amount ?? 0;
    res.json(resolvedSlackMessage(decision, slackUser, agentName, vendor, amount));
  },
);

// All other routes use JSON body parsing
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "agentvault-checkpoint" });
});

app.post("/checkpoint", async (req: Request, res: Response) => {
  const body = req.body as Partial<CheckpointRequest> | undefined;
  if (
    !body ||
    typeof body.credential !== "string" ||
    typeof body.vendor !== "string" ||
    typeof body.amount !== "number"
  ) {
    const reply: CheckpointResponse = {
      status: "blocked",
      reason:
        "Malformed request: credential (string), vendor (string), and amount (number) are required",
    };
    res.status(400).json(reply);
    return;
  }

  try {
    const result = await evaluateCheckpoint({
      credential: body.credential,
      vendor: body.vendor,
      amount: body.amount,
      protocol: body.protocol,
      endpoint: body.endpoint,
    });
    res.status(200).json(result);
  } catch (err) {
    console.error("[checkpoint] evaluation error", err);
    const reply: CheckpointResponse = {
      status: "blocked",
      reason: "Internal error during evaluation",
    };
    res.status(500).json(reply);
  }
});

app.get("/escalations", async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const where = status ? { status } : {};
  const rows = await prisma.escalation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { transaction: { include: { agent: true } } },
  });
  res.json(
    rows.map((row) => ({
      id: row.id,
      transactionId: row.transactionId,
      agentId: row.transaction.agentId,
      agentName: row.transaction.agent.name,
      vendor: row.transaction.vendor,
      amount: row.transaction.amount,
      reason: row.transaction.reason,
      status: row.status,
      notifiedAt: row.notifiedAt?.toISOString() ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      resolvedBy: row.resolvedBy,
      createdAt: row.createdAt.toISOString(),
    })),
  );
});

app.post(
  "/escalations/:id/resolve",
  async (req: Request, res: Response) => {
    const id = req.params.id;
    const body = req.body as Partial<ResolveEscalationRequest> | undefined;
    if (
      !body ||
      (body.decision !== "approved" && body.decision !== "blocked")
    ) {
      res.status(400).json({ error: "decision must be 'approved' or 'blocked'" });
      return;
    }
    const resolvedBy =
      typeof body.resolvedBy === "string" && body.resolvedBy.length > 0
        ? body.resolvedBy
        : "unknown";

    const result = await resolveEscalation(id, body.decision, resolvedBy);
    if (!result.ok) {
      res.status(409).json({ error: result.reason });
      return;
    }
    res.json({ ok: true });
  },
);

app.use(mockX402);
app.use(mockServices);

app.listen(PORT, () => {
  console.log(`[checkpoint] listening on http://localhost:${PORT}`);
});
