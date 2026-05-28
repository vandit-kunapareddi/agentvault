import { Router, type Request, type Response } from "express";
import type { Protocol } from "@agentvault/types";

export const mockServices = Router();

interface ProtocolFixture {
  protocol: Exclude<Protocol, "unknown">;
  paymentHeader: Record<string, string>;
  describe: (host: string) => unknown;
}

const FIXTURES: ProtocolFixture[] = [
  {
    protocol: "x402",
    paymentHeader: { "x-payment-required": "x402" },
    describe: (host) => ({
      scheme: "x402",
      network: "base",
      payTo: "0x52ce000000000000000000000000000000000000",
      maxAmountRequired: "0.05",
      resource: `https://${host}`,
    }),
  },
  {
    protocol: "mpp",
    paymentHeader: { "x-mpp-session": "sess_mock_0001" },
    describe: (host) => ({
      scheme: "mpp",
      session: "sess_mock_0001",
      resource: `https://${host}`,
    }),
  },
  {
    protocol: "acp",
    paymentHeader: { "x-acp-checkout": "chk_mock_0001" },
    describe: (host) => ({
      scheme: "acp",
      checkoutId: "chk_mock_0001",
      resource: `https://${host}`,
    }),
  },
];

for (const fixture of FIXTURES) {
  mockServices.get(`/mock/${fixture.protocol}`, (req: Request, res: Response) => {
    res.setHeader("X-Payment-Protocol", fixture.protocol);
    for (const [k, v] of Object.entries(fixture.paymentHeader)) {
      res.setHeader(k, v);
    }
    res.status(402).json({
      error: "payment required",
      protocol: fixture.protocol,
      accepts: fixture.describe(req.headers.host ?? "mock-service.local"),
    });
  });
}
