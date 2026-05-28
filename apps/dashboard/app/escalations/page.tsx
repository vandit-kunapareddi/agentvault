import { EscalationsList } from "./EscalationsList";

export const dynamic = "force-dynamic";

export default function EscalationsPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Escalations</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Payments paused awaiting human approval. Each escalation auto-blocks if no
          decision is made before the timer expires.
        </p>
      </header>
      <EscalationsList />
    </div>
  );
}
