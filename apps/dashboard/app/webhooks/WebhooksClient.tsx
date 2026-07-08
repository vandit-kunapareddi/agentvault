"use client";

import { useEffect, useState, type FormEvent } from "react";
import { KNOWN_EVENT_TYPES, type KnownEventType } from "@/lib/webhooks";
import { isDemoMode } from "@/lib/demo";

interface WebhookRow {
  id: string;
  url: string;
  description: string | null;
  eventFilter: KnownEventType[] | null;
  isActive: boolean;
  createdAt: string;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: number | null;
  lastDeliveryError: string | null;
}

interface CreatedWebhook extends WebhookRow {
  secret: string;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return `${Math.round(diffMs / 1000)}s ago`;
  if (diffMs < 3_600_000) return `${Math.round(diffMs / 60_000)}m ago`;
  if (diffMs < 86_400_000) return `${Math.round(diffMs / 3_600_000)}h ago`;
  return `${Math.round(diffMs / 86_400_000)}d ago`;
}

function statusLabel(status: number | null, error: string | null): string {
  if (status === null) return "—";
  if (status === 0) return error ? `error: ${error}` : "network error";
  if (status >= 200 && status < 300) return `OK · ${status}`;
  return `HTTP ${status}`;
}

function statusClass(status: number | null): string {
  if (status === null) return "text-[var(--muted)]";
  if (status >= 200 && status < 300)
    return "text-emerald-700 dark:text-emerald-300";
  return "text-red-700 dark:text-red-300";
}

export function WebhooksClient() {
  const demo = isDemoMode();
  const [rows, setRows] = useState<WebhookRow[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState<CreatedWebhook | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    try {
      const data = (await fetch("/api/webhooks", { cache: "no-store" }).then(
        (r) => r.json(),
      )) as WebhookRow[];
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  async function toggleActive(row: WebhookRow) {
    await fetch(`/api/webhooks/${row.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    refresh();
  }

  async function remove(row: WebhookRow) {
    if (!confirm(`Delete webhook for ${row.url}?`)) return;
    await fetch(`/api/webhooks/${row.id}`, { method: "DELETE" });
    refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {created && (
        <NewSecretBanner
          webhook={created}
          copied={copied}
          onCopy={() => {
            navigator.clipboard.writeText(created.secret).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          onDismiss={() => setCreated(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <div className="text-xs text-[var(--muted)]">
          {rows === null ? "Loading…" : `${rows.length} webhook${rows.length === 1 ? "" : "s"}`}
        </div>
        {demo ? (
          <span className="text-xs text-[var(--muted)]">
            Read-only demo — managing webhooks disabled
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {showForm ? "Cancel" : "+ New webhook"}
          </button>
        )}
      </div>

      {showForm && (
        <NewWebhookForm
          onCreated={(c) => {
            setCreated(c);
            setShowForm(false);
            refresh();
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      {rows !== null && rows.length === 0 && !showForm && (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">
          No webhooks yet. Create one to start receiving event deliveries when
          checkpoint decisions land.
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-black/[.02] text-left text-xs uppercase tracking-wide text-[var(--muted)] dark:bg-white/[.02]">
              <tr>
                <th className="px-4 py-3 font-medium">URL</th>
                <th className="px-4 py-3 font-medium">Events</th>
                <th className="px-4 py-3 font-medium">Active</th>
                <th className="px-4 py-3 font-medium">Last delivery</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[var(--border)] align-top hover:bg-black/[.02] dark:hover:bg-white/[.02]"
                >
                  <td className="px-4 py-3">
                    <div className="break-all font-mono text-xs">{row.url}</div>
                    {row.description && (
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        {row.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {row.eventFilter && row.eventFilter.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {row.eventFilter.map((e) => (
                          <span
                            key={e}
                            className="rounded-full bg-black/[.05] px-2 py-0.5 text-[10px] font-mono dark:bg-white/[.06]"
                          >
                            {e}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">All events</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(row)}
                      disabled={demo}
                      title={
                        demo
                          ? "Disabled in the read-only demo"
                          : row.isActive
                            ? "Click to pause"
                            : "Click to activate"
                      }
                      className={`flex items-center gap-2 text-xs disabled:cursor-default ${
                        row.isActive
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-[var(--muted)]"
                      }`}
                    >
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          row.isActive ? "bg-emerald-500" : "bg-zinc-400"
                        }`}
                      />
                      {row.isActive ? "active" : "paused"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs">
                      {formatRelative(row.lastDeliveryAt)}
                    </div>
                    <div
                      className={`text-[10px] font-mono ${statusClass(row.lastDeliveryStatus)}`}
                    >
                      {statusLabel(row.lastDeliveryStatus, row.lastDeliveryError)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => remove(row)}
                      disabled={demo}
                      aria-label="Delete webhook"
                      title={demo ? "Disabled in the read-only demo" : undefined}
                      className="rounded-md border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:bg-black/[.04] disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-white/[.04]"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewSecretBanner({
  webhook,
  copied,
  onCopy,
  onDismiss,
}: {
  webhook: CreatedWebhook;
  copied: boolean;
  onCopy: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950/30">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="font-medium">Webhook created — save the secret now.</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            This is the only time the signing secret will be shown. The
            dashboard cannot retrieve it later. Add it to the receiving
            service to verify the <code className="font-mono">X-AgentVault-Signature</code>{" "}
            header on every delivery.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="block break-all rounded border border-[var(--border)] bg-[var(--background)] px-3 py-2 font-mono text-xs">
              {webhook.secret}
            </code>
            <button
              type="button"
              onClick={onCopy}
              className="shrink-0 rounded-md bg-[var(--accent)] px-3 py-2 text-xs font-medium text-white hover:opacity-90"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="rounded-md p-1 text-[var(--muted)] hover:bg-black/[.04] dark:hover:bg-white/[.04]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function NewWebhookForm({
  onCreated,
  onError,
}: {
  onCreated: (w: CreatedWebhook) => void;
  onError: (msg: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<KnownEventType>>(
    new Set(),
  );
  const [submitting, setSubmitting] = useState(false);

  const allEvents = selectedEvents.size === 0;

  function toggleEvent(e: KnownEventType) {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          description: description.trim() || undefined,
          eventFilter: allEvents ? null : Array.from(selectedEvents),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Create failed (${res.status})`);
      }
      const data = (await res.json()) as CreatedWebhook;
      onCreated(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 rounded-lg border border-[var(--border)] p-5"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">URL</span>
        <input
          required
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.example.com/agentvault"
          className={`${inputClass} font-mono text-xs`}
        />
        <span className="text-xs text-[var(--muted)]">
          The endpoint that will receive POST requests with each event.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Description (optional)</span>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Datadog audit ingest"
          maxLength={200}
          className={inputClass}
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium">Event filter</legend>
        <p className="text-xs text-[var(--muted)]">
          Leave all unchecked to receive every event. Otherwise only the
          selected types will be delivered.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {KNOWN_EVENT_TYPES.map((e) => (
            <label
              key={e}
              className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-xs font-mono"
            >
              <input
                type="checkbox"
                checked={selectedEvents.has(e)}
                onChange={() => toggleEvent(e)}
              />
              {e}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center justify-end gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create webhook"}
        </button>
      </div>
    </form>
  );
}
