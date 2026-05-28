"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface StatsResponse {
  dailySpend: { date: string; amount: number }[];
  perAgentSpend: { agentName: string; amount: number }[];
}

const ACCENT = "#6366f1";
const BAR_COLORS = ["#6366f1", "#0ea5e9", "#14b8a6", "#f59e0b", "#ef4444", "#a855f7", "#84cc16", "#ec4899"];

function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function SpendCharts() {
  const [stats, setStats] = useState<StatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const data = (await fetch("/api/stats", { cache: "no-store" }).then((r) =>
          r.json(),
        )) as StatsResponse;
        if (!cancelled) setStats(data);
      } catch {
        // next tick retries
      }
    }
    tick();
    const id = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const hasDaily = stats?.dailySpend.some((d) => d.amount > 0) ?? false;
  const hasAgents = (stats?.perAgentSpend.length ?? 0) > 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-[var(--border)] p-4">
        <h3 className="text-sm font-medium">Approved spend · last 14 days</h3>
        <div className="mt-3 h-56">
          {!stats ? (
            <Placeholder text="Loading…" />
          ) : !hasDaily ? (
            <Placeholder text="No approved spend yet." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.dailySpend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <Tooltip
                  formatter={(v: number) => [money(v), "Spend"]}
                  labelFormatter={(l: string) => shortDate(l)}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }}
                />
                <Bar dataKey="amount" fill={ACCENT} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-[var(--border)] p-4">
        <h3 className="text-sm font-medium">Approved spend by agent</h3>
        <div className="mt-3 h-56">
          {!stats ? (
            <Placeholder text="Loading…" />
          ) : !hasAgents ? (
            <Placeholder text="No approved spend yet." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.perAgentSpend}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--border)" }}
                  tickFormatter={(v: number) => `$${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="agentName"
                  tick={{ fontSize: 11, fill: "var(--muted)" }}
                  tickLine={false}
                  axisLine={false}
                  width={110}
                />
                <Tooltip
                  formatter={(v: number) => [money(v), "Spend"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }}
                />
                <Bar dataKey="amount" radius={[0, 3, 3, 0]}>
                  {stats.perAgentSpend.map((_, i) => (
                    <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function Placeholder({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
      {text}
    </div>
  );
}
