import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { sanitizeWebhook, validateWebhookInput } from "@/lib/webhooks";

export async function GET() {
  const rows = await prisma.webhook.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(rows.map(sanitizeWebhook));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const validated = validateWebhookInput(body, { requireUrl: true });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  // 256-bit secret, generated server-side. Returned to the caller exactly
  // once (in this response) and never again — subscribers must save it
  // immediately, the dashboard cannot show it later.
  const secret = crypto.randomBytes(32).toString("hex");
  const created = await prisma.webhook.create({
    data: {
      url: validated.value.url!,
      secret,
      description: validated.value.description ?? null,
      eventFilter: validated.value.eventFilter ?? undefined,
    },
  });
  return NextResponse.json(
    { ...sanitizeWebhook(created), secret },
    { status: 201 },
  );
}
