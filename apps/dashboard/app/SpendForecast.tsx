"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Forecast } from "@/lib/forecast";

interface AgentRow {
  id: string;
  name: string;
  dailyCap: number;
  forecast?: Forecast;
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

type Status = "on-track" | "near-cap" | "over-pace";

function statusOf(f: Forecast | undefined): Status {
  if (!f) return "on-track";
  if (f.willExceedCap) return "over-pace";
  if (f.nearCap) return "near-cap";
  return "on-track";
}

const statusPill: Record<Status, string> = {
  "on-track":
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  "near-cap":
    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  "over-pace":
    "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

const statusLabel: Record<Status, string> = {
  "on-track": "On track",
  "near-cap": "Near cap",
  "over-pace": "Over pace",
};

export function SpendForecast() {
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
        // next tick retries
      }
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (rows === null) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
        Loading forecast…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
        No agents to forecast yet.
      </div>
    );
  }

  const statusRank: Record<Status, number> = {
    "over-pace": 0,
    "near-cap": 1,
    "on-track": 2,
  };
  const sorted = [...rows].sort((a, b) => {
    const r = statusRank[statusOf(a.forecast)] - statusRank[statusOf(b.forecast)];
    if (r !== 0) return r;
    return (b.forecast?.avgDaily ?? 0) - (a.forecast?.avgDaily ?? 0);
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-black/[.02] text-left text-xs uppercase tracking-wide text-[var(--muted)] dark:bg-white/[.02]">
          <tr>
            <th className="px-4 py-3 font-medium">Agent</th>
            <th className="px-4 py-3 font-medium text-right">Avg / day</th>
            <th className="px-4 py-3 font-medium text-right">Projected 7d</th>
            <th className="px-4 py-3 font-medium text-right">Projected 30d</th>
            <th className="px-4 py-3 font-medium text-right">Daily cap</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const f = r.forecast;
            const status = statusOf(f);
            return (
              <tr
                key={r.id}
                className="border-t border-[var(--border)] hover:bg-black/[.02] dark:hover:bg-white/[.02]"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/agents/${r.id}`}
                    className="font-medium hover:text-[var(--accent)]"
                  >
                    {r.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {money(f?.avgDaily ?? 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {money(f?.projected7d ?? 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {money(f?.projected30d ?? 0)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--muted)]">
                  {money(r.dailyCap)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusPill[status]}`}
                  >
                    {statusLabel[status]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
