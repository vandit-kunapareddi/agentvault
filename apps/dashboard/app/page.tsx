import Link from "next/link";
import { SpendingTree } from "./SpendingTree";
import { SpendCharts } from "./SpendCharts";
import { AgentTable } from "./AgentTable";
import { Insights } from "./Insights";
import { SpendForecast } from "./SpendForecast";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-3">
        <header className="flex items-end justify-between">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
              Spending tree
            </h2>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Top-level agents and the sub-agents they hired. Live-updating every 2.5s.
            </p>
          </div>
        </header>
        <SpendingTree />
      </section>

      <section className="flex flex-col gap-3">
        <header>
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
            Suggestions
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Patterns spotted from the last 7 days of blocks and escalations.
          </p>
        </header>
        <Insights />
      </section>

      <section className="flex flex-col gap-3">
        <header>
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
            Spend forecast
          </h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Projection from each agent&apos;s average daily approved spend over the last 7 days.
          </p>
        </header>
        <SpendForecast />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Spend analytics
        </h2>
        <SpendCharts />
      </section>

      <section className="flex flex-col gap-4">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">All agents</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Every agent registered with AgentVault and the spending rules attached to its credential.
            </p>
          </div>
          <Link
            href="/agents/new"
            className="self-start whitespace-nowrap rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-black/[.04] dark:hover:bg-white/[.04]"
          >
            + New agent
          </Link>
        </header>
        <AgentTable />
      </section>
    </div>
  );
}
