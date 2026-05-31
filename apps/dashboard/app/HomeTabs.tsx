"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SpendingTree } from "./SpendingTree";
import { SpendForecast } from "./SpendForecast";
import { SpendCharts } from "./SpendCharts";
import { AgentTable } from "./AgentTable";

type TabId = "tree" | "forecast" | "analytics" | "agents";

interface TabDef {
  id: TabId;
  label: string;
  description: string;
}

const TABS: TabDef[] = [
  {
    id: "tree",
    label: "Spending tree",
    description:
      "Top-level agents and the sub-agents they hired. Live-updating every 2.5s.",
  },
  {
    id: "forecast",
    label: "Forecast",
    description:
      "Projection from each agent's average daily approved spend over the last 7 days.",
  },
  {
    id: "analytics",
    label: "Analytics",
    description: "Approved spend over the last 14 days and per-agent breakdown.",
  },
  {
    id: "agents",
    label: "Agents",
    description:
      "Every agent registered with AgentVault and the spending rules attached to its credential.",
  },
];

function isTabId(s: string): s is TabId {
  return TABS.some((t) => t.id === s);
}

export function HomeTabs() {
  const [tab, setTab] = useState<TabId>("tree");

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (isTabId(hash)) setTab(hash);
  }, []);

  function select(id: TabId) {
    setTab(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
    }
  }

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div
          className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border)]"
          role="tablist"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => select(t.id)}
              className={`relative whitespace-nowrap px-4 py-2 text-sm font-medium transition ${
                tab === t.id
                  ? "text-[var(--accent)]"
                  : "text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {t.label}
              {tab === t.id && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 bg-[var(--accent)]" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-[var(--muted)]">{current.description}</p>
          {tab === "agents" && (
            <Link
              href="/agents/new"
              className="whitespace-nowrap rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-black/[.04] dark:hover:bg-white/[.04]"
            >
              + New agent
            </Link>
          )}
        </div>
      </div>

      {tab === "tree" && <SpendingTree />}
      {tab === "forecast" && <SpendForecast />}
      {tab === "analytics" && <SpendCharts />}
      {tab === "agents" && <AgentTable />}
    </div>
  );
}
