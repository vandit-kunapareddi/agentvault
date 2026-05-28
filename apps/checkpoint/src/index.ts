import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import express, { type Request, type Response } from "express";
import type {
  CheckpointRequest,
  CheckpointResponse,
} from "@agentvault/types";
import { evaluateCheckpoint } from "./checkpoint.js";
import { mockX402 } from "./mock-x402.js";

const here = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(here, "../../../.env") });

const PORT = Number(process.env.CHECKPOINT_PORT ?? 4000);

const app = express();
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
      reason: "Malformed request: credential (string), vendor (string), and amount (number) are required",
    };
    res.status(400).json(reply);
    return;
  }

  try {
    const result = await evaluateCheckpoint({
      credential: body.credential,
      vendor: body.vendor,
      amount: body.amount,
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

app.use(mockX402);

app.listen(PORT, () => {
  console.log(`[checkpoint] listening on http://localhost:${PORT}`);
});
