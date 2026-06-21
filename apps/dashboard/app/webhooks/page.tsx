import { WebhooksClient } from "./WebhooksClient";

export const dynamic = "force-dynamic";

export default function WebhooksPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Webhooks</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Deliver checkpoint events to external systems. Each event is signed
          with an HMAC the subscriber verifies before acting. Bounded retries
          on transient failures; never blocks the checkpoint pipeline.
        </p>
      </header>
      <WebhooksClient />
    </div>
  );
}
