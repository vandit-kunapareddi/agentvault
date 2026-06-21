import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { sanitizeWebhook, validateWebhookInput } from "@/lib/webhooks";

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/webhooks/[id]">,
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const validated = validateWebhookInput(body, { requireUrl: false });
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (validated.value.url !== undefined) data.url = validated.value.url;
  if (validated.value.description !== undefined) {
    data.description = validated.value.description;
  }
  if (validated.value.eventFilter !== undefined) {
    data.eventFilter = validated.value.eventFilter ?? null;
  }
  if (validated.value.isActive !== undefined) {
    data.isActive = validated.value.isActive;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No fields to update" },
      { status: 400 },
    );
  }
  try {
    const updated = await prisma.webhook.update({ where: { id }, data });
    return NextResponse.json(sanitizeWebhook(updated));
  } catch {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }
}

export async function DELETE(
  _req: NextRequest,
  ctx: RouteContext<"/api/webhooks/[id]">,
) {
  const { id } = await ctx.params;
  try {
    await prisma.webhook.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }
}
