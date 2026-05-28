import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { splitVendors } from "@/lib/vendors";
import { CredentialField } from "./CredentialField";
import { TransactionList } from "@/app/transactions/TransactionList";

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

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await prisma.agent.findUnique({ where: { id } });
  if (!agent) notFound();

  const vendors = splitVendors(agent.approvedVendors);
  const expired = agent.expiresAt.getTime() <= Date.now();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
            ← All agents
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">{agent.name}</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">{agent.id}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            expired
              ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          }`}
        >
          {expired ? "Expired" : "Active"}
        </span>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card label="Authorized by" value={agent.authorizedBy} />
        <Card label="Trust" value={`${agent.trustTier} · ${Math.round(agent.trustScore)}`} />
        <Card label="Wallet address" value={agent.walletAddress} mono />
        <Card label="Expires" value={formatDate(agent.expiresAt)} />
        <Card label="Per-transaction limit" value={formatCurrency(agent.perTxLimit)} />
        <Card label="Daily cap" value={formatCurrency(agent.dailyCap)} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Approved vendors
        </h2>
        {vendors.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">None.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {vendors.map((v) => (
              <li
                key={v}
                className="rounded-md border border-[var(--border)] px-2.5 py-1 font-mono text-xs"
              >
                {v}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Signed credential (JWT)
        </h2>
        <p className="text-xs text-[var(--muted)]">
          Attach this token to every payment request the agent makes. The checkpoint will verify
          the signature, expiry, and spending rules encoded inside.
        </p>
        <CredentialField value={agent.credential} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Try it
        </h2>
        <pre className="overflow-x-auto rounded-md border border-[var(--border)] bg-black/[.03] p-3 font-mono text-xs dark:bg-white/[.03]">
{`curl -X POST http://localhost:4000/checkpoint \\
  -H "content-type: application/json" \\
  -d '{
    "credential": "${agent.credential ?? "<no credential>"}",
    "vendor": "${vendors[0] ?? "exa.ai"}",
    "amount": ${(agent.perTxLimit / 2).toFixed(2)}
  }'`}
        </pre>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Recent transactions
        </h2>
        <TransactionList agentId={agent.id} limit={25} showAgentColumn={false} />
      </section>
    </div>
  );
}

function Card({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className={`mt-1 text-base font-medium ${mono ? "break-all font-mono text-sm" : ""}`}>
        {value}
      </div>
    </div>
  );
}
