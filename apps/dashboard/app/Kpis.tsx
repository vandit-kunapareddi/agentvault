"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface SummaryResponse {
  agentCount: number;
  todayApprovedTotal: number;
  pendingEscalations: number;
  suggestionsCount: number;
}

interface Stat {
  label: string;
  value: string;
  href?: string;
  emphasis?: "default" | "warning" | "critical";
}

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

const emphasisClass: Record<NonNullable<Stat["emphasis"]>, string> = {
  default: "",
  warning: "text-amber-600 dark:text-amber-400",
  critical: "text-red-600 dark:text-red-400",
};

export function Kpis() {
  const [data, setData] = useState<SummaryResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/summary", { cache: "no-store" });
        const json = (await res.json()) as SummaryResponse;
        if (!cancelled) setData(json);
      } catch {
        // next tick retries
      }
    }
    tick();
    const id = setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const stats: Stat[] = [
    { label: "Agents", value: data ? String(data.agentCount) : "—" },
    {
      label: "Approved today",
      value: data ? money(data.todayApprovedTotal) : "—",
    },
    {
      label: "Pending escalations",
      value: data ? String(data.pendingEscalations) : "—",
      href: "/escalations",
      emphasis: data && data.pendingEscalations > 0 ? "warning" : "default",
    },
    {
      label: "Suggestions",
      value: data ? String(data.suggestionsCount) : "—",
      emphasis: data && data.suggestionsCount > 0 ? "warning" : "default",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => {
        const inner = (
          <div className="rounded-lg border border-[var(--border)] p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
              {s.label}
            </div>
            <div
              className={`mt-1 text-2xl font-semibold tracking-tight ${emphasisClass[s.emphasis ?? "default"]}`}
            >
              {s.value}
            </div>
          </div>
        );
        return s.href ? (
          <Link key={s.label} href={s.href} className="block hover:opacity-90">
            {inner}
          </Link>
        ) : (
          <div key={s.label}>{inner}</div>
        );
      })}
    </div>
  );
}
