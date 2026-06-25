import { Router, type Request, type Response } from "express";
import type { MockPaymentRequest, MockPaymentResponse } from "@vanditk2/agentvault-types";

export const mockX402 = Router();

mockX402.post("/mock-x402/:vendor", (req: Request, res: Response) => {
  const vendor = decodeURIComponent(req.params.vendor ?? "").trim();
  if (!vendor) {
    res.status(400).json({ error: "vendor path param required" });
    return;
  }

  const body = (req.body ?? {}) as Partial<MockPaymentRequest>;
  const amount = body.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }

  const response: MockPaymentResponse = {
    receiptId: `x402_${Math.random().toString(36).slice(2, 10)}`,
    vendor,
    amount,
    currency: "USDC",
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});
