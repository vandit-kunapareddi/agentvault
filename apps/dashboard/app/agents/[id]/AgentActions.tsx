"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { isDemoMode } from "@/lib/demo";

interface AgentActionsProps {
  agentId: string;
  expired: boolean;
}

export function AgentActions({ agentId, expired }: AgentActionsProps) {
  const demo = isDemoMode();
  const router = useRouter();
  const [expiring, setExpiring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function expireNow() {
    if (expiring) return;
    if (
      !window.confirm(
        "Expire this agent's credential now? Future payments will be blocked until you re-issue one.",
      )
    ) {
      return;
    }
    setError(null);
    setExpiring(true);
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ expiresAt: new Date().toISOString() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to expire");
    } finally {
      setExpiring(false);
    }
  }

  if (demo) {
    return (
      <p className="text-xs text-[var(--muted)]">
        Read-only demo — editing disabled
      </p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/agents/${agentId}/edit`}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-black/[.04] dark:hover:bg-white/[.04]"
        >
          Edit
        </Link>
        <button
          type="button"
          onClick={expireNow}
          disabled={expiring || expired}
          title={expired ? "Already expired" : "Expire this agent's credential now"}
          className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
        >
          {expiring ? "Expiring…" : "Expire now"}
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
