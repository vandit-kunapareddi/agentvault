import Link from "next/link";
import { prisma } from "@/lib/db";
import { splitVendors } from "@/lib/vendors";
import { SpendingTree } from "./SpendingTree";

export const dynamic = "force-dynamic";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function HomePage() {
  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: "desc" },
    include: { transactions: true },
  });

  const now = Date.now();

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

      <section className="flex flex-col gap-4">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">All agents</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Every agent registered with AgentVault and the spending rules attached to its credential.
            </p>
          </div>
          <Link
            href="/agents/new"
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-black/[.04] dark:hover:bg-white/[.04]"
          >
            + New agent
          </Link>
        </header>

        {agents.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-12 text-center">
            <p className="text-base font-medium">No agents yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Register your first agent to issue a spending credential and start logging
              transactions.
            </p>
            <Link
              href="/agents/new"
              className="mt-4 inline-block rounded-md bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90"
            >
              Register an agent
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-black/[.02] text-left text-xs uppercase tracking-wide text-[var(--muted)] dark:bg-white/[.02]">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Authorized by</th>
                  <th className="px-4 py-3 font-medium">Daily cap</th>
                  <th className="px-4 py-3 font-medium">Per-tx limit</th>
                  <th className="px-4 py-3 font-medium">Vendors</th>
                  <th className="px-4 py-3 font-medium">Txns</th>
                  <th className="px-4 py-3 font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => {
                  const vendors = splitVendors(agent.approvedVendors);
                  const expired = agent.expiresAt.getTime() <= now;
                  return (
                    <tr
                      key={agent.id}
                      className="border-t border-[var(--border)] hover:bg-black/[.02] dark:hover:bg-white/[.02]"
                    >
                      <td className="px-4 py-3">
                        <Link href={`/agents/${agent.id}`} className="block">
                          <div className="font-medium hover:text-[var(--accent)]">{agent.name}</div>
                          <div className="text-xs text-[var(--muted)]">{agent.id}</div>
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
                      <td className="px-4 py-3 text-[var(--muted)]">{agent.authorizedBy}</td>
                      <td className="px-4 py-3">{formatCurrency(agent.dailyCap)}</td>
                      <td className="px-4 py-3">{formatCurrency(agent.perTxLimit)}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-black/[.05] px-2 py-0.5 text-xs dark:bg-white/[.06]">
                          {vendors.length}
                        </span>
                      </td>
                      <td className="px-4 py-3">{agent.transactions.length}</td>
                      <td className="px-4 py-3 text-[var(--muted)]">{formatDate(agent.expiresAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
