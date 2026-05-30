"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Insight, InsightSeverity } from "@/lib/insights";

interface InsightsResponse {
  insights: Insight[];
  windowDays: number;
}

const severityDot: Record<InsightSeverity, string> = {
  critical: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

const severityRing: Record<InsightSeverity, string> = {
  critical: "bg-red-400",
  warning: "bg-amber-400",
  info: "bg-sky-400",
};

const severityLabel: Record<InsightSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Heads-up",
};

export function Insights() {
  const [data, setData] = useState<InsightsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/insights", { cache: "no-store" });
        const json = (await res.json()) as InsightsResponse;
        if (!cancelled) setData(json);
      } catch {
        // next tick will retry
      }
    }
    tick();
    const id = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!data) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
        Looking for patterns…
      </div>
    );
  }

  if (data.insights.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
        All clear — nothing to suggest right now. Keep using your agents and
        we&apos;ll surface patterns as they emerge.
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {data.insights.map((ins) => (
        <li
          key={ins.id}
          className="rounded-lg border border-[var(--border)] p-4"
        >
          <div className="flex items-start gap-3">
            <span
              className="relative mt-1 inline-flex h-2.5 w-2.5 shrink-0"
              title={severityLabel[ins.severity]}
            >
              {ins.severity !== "info" && (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 ${severityRing[ins.severity]}`}
                />
              )}
              <span
                className={`relative inline-flex h-2.5 w-2.5 rounded-full ${severityDot[ins.severity]}`}
              />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <Link
                  href={`/agents/${ins.agentId}`}
                  className="font-semibold hover:text-[var(--accent)]"
                >
                  {ins.agentName}
                </Link>
                <span className="text-[var(--muted)]">·</span>
                <span className="text-[var(--muted)]">{ins.message}</span>
              </div>
              <p className="text-xs text-[var(--muted)]">
                <span className="font-medium text-[var(--foreground)]">
                  Suggestion:
                </span>{" "}
                {ins.suggestion}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-black/[.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)] dark:bg-white/[.06]">
              {ins.count}×
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
