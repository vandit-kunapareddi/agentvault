import { TransactionList } from "./TransactionList";

export const dynamic = "force-dynamic";

export default function TransactionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Every checkpoint decision is logged here. Filter by status to focus on what matters.
        </p>
      </header>
      <TransactionList />
    </div>
  );
}
