"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { trustTierBadge } from "@/lib/status";
import {
  healthDot,
  healthLabel,
  healthRing,
  type AgentHealth,
} from "@/lib/health";

interface AgentRow {
  id: string;
  name: string;
  trustTier: string;
  trustScore: number;
  authorizedBy: string;
  dailyCap: number;
  perTxLimit: number;
  approvedVendors: string[];
  expiresAt: string;
  health: AgentHealth;
  transactionCount: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function HealthDot({ health }: { health: AgentHealth }) {
  return (
    <span
      className="relative inline-flex h-2.5 w-2.5 shrink-0"
      title={healthLabel[health]}
      aria-label={healthLabel[health]}
    >
      {health !== "healthy" && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${healthRing[health]}`}
        />
      )}
      <span
        className={`relative inline-flex h-2.5 w-2.5 rounded-full ${healthDot[health]}`}
      />
    </span>
  );
}

export function AgentTable() {
  const [rows, setRows] = useState<AgentRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const data = (await fetch("/api/agents", { cache: "no-store" }).then((r) =>
          r.json(),
        )) as AgentRow[];
        if (!cancelled) setRows(data);
      } catch {
        // swallow — next tick retries
      }
    }
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (rows === null) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">
        Loading agents…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
        <p className="text-base font-medium">
          No agents registered yet. Add your first agent to get started.
        </p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Register an agent to issue a spending credential and start logging
          transactions.
        </p>
        <Link
          href="/agents/new"
          className="mt-4 inline-block rounded-md bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90"
        >
          Register an agent
        </Link>
      </div>
    );
  }

  const now = Date.now();

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
        <thead className="bg-black/[.02] text-left text-xs uppercase tracking-wide text-[var(--muted)] dark:bg-white/[.02]">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Trust</th>
            <th className="px-4 py-3 font-medium">Authorized by</th>
            <th className="px-4 py-3 font-medium">Daily cap</th>
            <th className="px-4 py-3 font-medium">Per-tx limit</th>
            <th className="px-4 py-3 font-medium">Vendors</th>
            <th className="px-4 py-3 font-medium">Txns</th>
            <th className="px-4 py-3 font-medium">Expires</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((agent) => {
            const expired = new Date(agent.expiresAt).getTime() <= now;
            return (
              <tr
                key={agent.id}
                className="border-t border-[var(--border)] hover:bg-black/[.02] dark:hover:bg-white/[.02]"
              >
                <td className="px-4 py-3">
                  <Link href={`/agents/${agent.id}`} className="block">
                    <div className="flex items-center gap-2">
                      <HealthDot health={agent.health} />
                      <span className="font-medium hover:text-[var(--accent)]">
                        {agent.name}
                      </span>
                    </div>
                    <div className="mt-0.5 pl-[18px] text-xs text-[var(--muted)]">
                      {agent.id}
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      expired
                        ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                        : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    }`}
                  >
                    {expired ? "Expired" : "Active"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${trustTierBadge(agent.trustTier)}`}
                  >
                    {agent.trustTier} · {Math.round(agent.trustScore)}
                  </span>
                </td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {agent.authorizedBy}
                </td>
                <td className="px-4 py-3">{formatCurrency(agent.dailyCap)}</td>
                <td className="px-4 py-3">{formatCurrency(agent.perTxLimit)}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-black/[.05] px-2 py-0.5 text-xs dark:bg-white/[.06]">
                    {agent.approvedVendors.length}
                  </span>
                </td>
                <td className="px-4 py-3">{agent.transactionCount}</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {formatDate(agent.expiresAt)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
