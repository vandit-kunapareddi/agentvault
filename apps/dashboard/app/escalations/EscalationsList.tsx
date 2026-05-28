"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { EscalationDecision, EscalationRow } from "@agentvault/types";

function statusPill(status: EscalationRow["status"]): string {
  switch (status) {
    case "approved":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "blocked":
      return "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300";
    case "timed_out":
      return "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
    case "pending":
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function formatRelative(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}

export function EscalationsList() {
  const [rows, setRows] = useState<EscalationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const resolvingRef = useRef<Set<string>>(new Set());
  const [resolvingTick, setResolvingTick] = useState(0);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const data = (await fetch("/api/escalations?limit=100", {
          cache: "no-store",
        }).then((r) => r.json())) as EscalationRow[];
        if (!cancelled) {
          setRows(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      }
    }
    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const { pending, resolved } = useMemo(() => {
    const p: EscalationRow[] = [];
    const r: EscalationRow[] = [];
    for (const row of rows ?? []) {
      if (row.status === "pending") p.push(row);
      else r.push(row);
    }
    return { pending: p, resolved: r.slice(0, 25) };
  }, [rows]);

  async function resolve(id: string, decision: EscalationDecision) {
    resolvingRef.current.add(id);
    setResolvingTick((t) => t + 1);
    try {
      const res = await fetch(`/api/escalations/${id}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Resolve failed (${res.status})`);
      } else {
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resolve failed");
    } finally {
      resolvingRef.current.delete(id);
      setResolvingTick((t) => t + 1);
    }
  }

  if (rows === null) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">
        Loading escalations…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <section className="flex flex-col gap-3">
        <header className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
            Pending {pending.length > 0 && `(${pending.length})`}
          </h2>
          <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-70" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
            </span>
            Polling every 2s
          </div>
        </header>

        {pending.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">
            No escalations awaiting decision.
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {pending.map((row) => {
              const createdAt = new Date(row.createdAt).getTime();
              const deadline = row.deadlineAt
                ? new Date(row.deadlineAt).getTime()
                : createdAt + 60_000;
              const totalMs = Math.max(1, deadline - createdAt);
              const remaining = Math.max(0, deadline - now);
              const pct = Math.min(1, remaining / totalMs);
              const isResolving = resolvingRef.current.has(row.id);
              void resolvingTick;
              return (
                <li
                  key={row.id}
                  className="flex flex-col gap-3 rounded-lg border border-amber-300/60 bg-amber-50/40 p-4 dark:border-amber-900/60 dark:bg-amber-950/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/agents/${row.agentId}`}
                          className="text-sm font-semibold hover:text-[var(--accent)]"
                        >
                          {row.agentName}
                        </Link>
                        <span className="text-xs text-[var(--muted)]">→</span>
                        <span className="font-mono text-xs">{row.vendor}</span>
                        <span className="text-sm font-mono">
                          ${row.amount.toFixed(2)}
                        </span>
                        {row.notifiedAt && (
                          <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                            · Slack notified
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted)]">{row.reason}</p>
                    </div>
                    <div className="text-right text-xs text-[var(--muted)]">
                      <div className="font-mono">
                        Auto-blocks in {Math.ceil(remaining / 1000)}s
                      </div>
                      <div className="mt-1 h-1 w-32 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.08]">
                        <div
                          className="h-full bg-amber-500 transition-all duration-500"
                          style={{ width: `${pct * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={isResolving}
                      onClick={() => resolve(row.id, "blocked")}
                      className="rounded-md border border-red-400 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950/30"
                    >
                      Block
                    </button>
                    <button
                      type="button"
                      disabled={isResolving}
                      onClick={() => resolve(row.id, "approved")}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {isResolving ? "Resolving…" : "Approve"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Recently resolved
        </h2>
        {resolved.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">Nothing resolved yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {resolved.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-4 rounded-md border border-[var(--border)] px-4 py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${statusPill(row.status)}`}
                  >
                    {row.status === "timed_out" ? "Timed out" : row.status}
                  </span>
                  <Link
                    href={`/agents/${row.agentId}`}
                    className="font-medium hover:text-[var(--accent)]"
                  >
                    {row.agentName}
                  </Link>
                  <span className="text-xs text-[var(--muted)]">→</span>
                  <span className="font-mono text-xs">{row.vendor}</span>
                  <span className="font-mono text-xs">
                    ${row.amount.toFixed(2)}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)]">
                  {row.resolvedBy && (
                    <span className="mr-2 font-mono">{row.resolvedBy}</span>
                  )}
                  {row.resolvedAt && <>at {formatTime(row.resolvedAt)}</>}
                  {!row.resolvedAt && (
                    <>{formatRelative(now - new Date(row.createdAt).getTime())}</>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
