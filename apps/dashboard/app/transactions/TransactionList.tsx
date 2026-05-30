"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CheckpointStatus } from "@agentvault/types";
import { protocolBadge, protocolLabel, statusLabel, statusPill } from "@/lib/status";
import type { TransactionRow } from "@/lib/transactions";

type Filter = "all" | CheckpointStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "recognized", label: "Recognized" },
  { value: "escalated", label: "Escalated" },
  { value: "blocked", label: "Blocked" },
];

function formatAbsolute(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 30_000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return `${Math.floor(diff / 86_400_000)}d ago`;
  }
  const d = new Date(iso);
  const sameYear = d.getUTCFullYear() === new Date().getUTCFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

interface TransactionCounts {
  all: number;
  approved: number;
  blocked: number;
  escalated: number;
  recognized: number;
}

export function TransactionList({
  agentId,
  limit = 200,
  showAgentColumn = true,
}: {
  agentId?: string;
  limit?: number;
  showAgentColumn?: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [rows, setRows] = useState<TransactionRow[] | null>(null);
  const [counts, setCounts] = useState<TransactionCounts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (agentId) params.set("agentId", agentId);
    if (filter !== "all") params.set("status", filter);
    params.set("limit", String(limit));
    const rowsUrl = `/api/transactions?${params.toString()}`;
    const countsUrl = `/api/transactions/counts${agentId ? `?agentId=${agentId}` : ""}`;

    async function tick() {
      try {
        const [data, c] = await Promise.all([
          fetch(rowsUrl, { cache: "no-store" }).then(
            (r) => r.json() as Promise<TransactionRow[]>,
          ),
          fetch(countsUrl, { cache: "no-store" }).then(
            (r) => r.json() as Promise<TransactionCounts>,
          ),
        ]);
        if (cancelled) return;
        const prev = prevIdsRef.current;
        const isFirst = prev.size === 0;
        const fresh = new Set<string>();
        if (!isFirst) {
          for (const row of data) if (!prev.has(row.id)) fresh.add(row.id);
        }
        prevIdsRef.current = new Set(data.map((r) => r.id));
        setRows(data);
        setCounts(c);
        if (fresh.size > 0) {
          setHighlightIds(fresh);
          setTimeout(() => {
            setHighlightIds(new Set());
          }, 1800);
        }
        setError(null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to fetch");
        }
      }
    }

    tick();
    const id = setInterval(tick, 2500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [agentId, filter, limit]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => {
            const count = counts ? counts[f.value] : null;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  filter === f.value
                    ? "bg-[var(--foreground)] text-[var(--background)]"
                    : "border border-[var(--border)] hover:bg-black/[.04] dark:hover:bg-white/[.04]"
                }`}
              >
                {f.label}
                {count !== null && (
                  <span className="ml-1.5 opacity-70">{count}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Polling every 2.5s
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {rows === null ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">
          Loading transactions…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">
          {filter === "all"
            ? "No transactions yet. Register an agent and run your first payment to see it here."
            : `No ${FILTERS.find((f) => f.value === filter)?.label.toLowerCase() ?? filter} transactions yet.`}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-black/[.02] text-left text-xs uppercase tracking-wide text-[var(--muted)] dark:bg-white/[.02]">
              <tr>
                <th className="px-4 py-3 font-medium">Time</th>
                {showAgentColumn && <th className="px-4 py-3 font-medium">Agent</th>}
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Protocol</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Reason</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const highlighted = highlightIds.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className={`border-t border-[var(--border)] transition-colors duration-1000 ${
                      highlighted
                        ? "bg-emerald-50 dark:bg-emerald-950/30"
                        : "hover:bg-black/[.02] dark:hover:bg-white/[.02]"
                    }`}
                  >
                    <td
                      className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[var(--muted)]"
                      title={formatAbsolute(row.createdAt)}
                    >
                      {formatRelative(row.createdAt)}
                    </td>
                    {showAgentColumn && (
                      <td className="px-4 py-3">
                        <Link
                          href={`/agents/${row.agentId}`}
                          className="font-medium hover:text-[var(--accent)]"
                        >
                          {row.agentName}
                        </Link>
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs">{row.vendor}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${protocolBadge(row.protocol)}`}
                      >
                        {protocolLabel(row.protocol)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      ${row.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusPill[row.status]}`}
                      >
                        {statusLabel[row.status]}
                      </span>
                    </td>
                    <td
                      className="max-w-md truncate px-4 py-3 text-xs text-[var(--muted)]"
                      title={row.reason ?? ""}
                    >
                      {row.reason ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
