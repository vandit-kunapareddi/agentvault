import { Insights } from "@/app/Insights";
import { Kpis } from "@/app/Kpis";
import { HomeTabs } from "@/app/HomeTabs";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <Kpis />

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

      <HomeTabs />
    </div>
  );
}
