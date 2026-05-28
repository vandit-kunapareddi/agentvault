import crypto from "node:crypto";

const MAX_TIMESTAMP_SKEW_SEC = 5 * 60;

export interface SlackNotificationInput {
  escalationId: string;
  agentName: string;
  vendor: string;
  amount: number;
  reason: string;
  timeoutMs: number;
  dashboardUrl: string;
}

export async function sendEscalationNotification(
  input: SlackNotificationInput,
): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;

  const seconds = Math.round(input.timeoutMs / 1000);
  const message = {
    text: `🚨 AgentVault escalation: ${input.agentName} wants $${input.amount.toFixed(2)} to ${input.vendor}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*AgentVault — escalation*\n*${input.agentName}* wants to pay *$${input.amount.toFixed(2)}* to *${input.vendor}*\n\n_${input.reason}_`,
        },
      },
      {
        type: "actions",
        block_id: input.escalationId,
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve" },
            style: "primary",
            action_id: "approve",
            value: input.escalationId,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Block" },
            style: "danger",
            action_id: "block",
            value: input.escalationId,
          },
        ],
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Auto-blocks in ${seconds}s if no response · <${input.dashboardUrl}/escalations|Open dashboard>`,
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(message),
    });
    if (!res.ok) {
      console.error(`[slack] webhook returned ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[slack] failed to send notification", err);
    return false;
  }
}

export function verifySlackSignature(
  rawBody: string,
  timestampHeader: string | undefined,
  signatureHeader: string | undefined,
): { ok: true } | { ok: false; reason: string } {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return { ok: false, reason: "SLACK_SIGNING_SECRET not configured" };
  if (!timestampHeader || !signatureHeader) {
    return { ok: false, reason: "Missing Slack signature headers" };
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: "Invalid timestamp header" };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestamp) > MAX_TIMESTAMP_SKEW_SEC) {
    return { ok: false, reason: "Timestamp outside acceptable skew" };
  }

  const base = `v0:${timestamp}:${rawBody}`;
  const expected =
    "v0=" + crypto.createHmac("sha256", secret).update(base).digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const givenBuf = Buffer.from(signatureHeader, "utf8");
  if (expectedBuf.length !== givenBuf.length) {
    return { ok: false, reason: "Signature length mismatch" };
  }
  if (!crypto.timingSafeEqual(expectedBuf, givenBuf)) {
    return { ok: false, reason: "Signature mismatch" };
  }
  return { ok: true };
}

export function resolvedSlackMessage(
  decision: "approved" | "blocked",
  user: string,
  agentName: string,
  vendor: string,
  amount: number,
): unknown {
  const verb = decision === "approved" ? "✅ Approved" : "❌ Blocked";
  return {
    replace_original: true,
    text: `${verb} by ${user}: ${agentName} → ${vendor} ($${amount.toFixed(2)})`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${verb} by *${user}*\n${agentName} → ${vendor} · $${amount.toFixed(2)}`,
        },
      },
    ],
  };
}
