"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { POLICY_TEMPLATES, type PolicyTemplate } from "@/lib/policyTemplates";

function defaultExpiresAtLocal(): string {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

interface AgentOption {
  id: string;
  name: string;
}

export interface AgentFormInitial {
  name?: string;
  authorizedBy?: string;
  dailyCap?: number;
  perTxLimit?: number;
  approvedVendors?: string[];
  vendorLimits?: Record<string, number>;
  expiresAt?: string; // ISO
}

interface AgentFormProps {
  mode: "create" | "edit";
  agentId?: string;
  initial?: AgentFormInitial;
  backHref?: string;
}

const inputClass =
  "w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

export function AgentForm({
  mode,
  agentId,
  initial,
  backHref = "/",
}: AgentFormProps) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [template, setTemplate] = useState<string>("");
  const [name, setName] = useState(initial?.name ?? "");
  const [authorizedBy, setAuthorizedBy] = useState(initial?.authorizedBy ?? "");
  const [dailyCap, setDailyCap] = useState(
    initial?.dailyCap !== undefined ? initial.dailyCap.toFixed(2) : "10.00",
  );
  const [perTxLimit, setPerTxLimit] = useState(
    initial?.perTxLimit !== undefined ? initial.perTxLimit.toFixed(2) : "0.50",
  );
  const [vendorsRaw, setVendorsRaw] = useState(
    initial?.approvedVendors?.join("\n") ?? "exa.ai\nhyperbolic.xyz\ncoingecko.com",
  );
  const [vendorLimitRows, setVendorLimitRows] = useState<
    { vendor: string; limit: string }[]
  >(
    initial?.vendorLimits
      ? Object.entries(initial.vendorLimits).map(([vendor, limit]) => ({
          vendor,
          limit: String(limit),
        }))
      : [],
  );
  const [expiresAt, setExpiresAt] = useState(
    initial?.expiresAt ? isoToLocalInput(initial.expiresAt) : defaultExpiresAtLocal(),
  );
  const [parentAgentId, setParentAgentId] = useState("");
  const [parents, setParents] = useState<AgentOption[]>([]);

  useEffect(() => {
    if (isEdit) return; // parent dropdown is create-only
    let cancelled = false;
    fetch("/api/agents", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: AgentOption[]) => {
        if (!cancelled) setParents(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isEdit]);

  function addVendorLimitRow() {
    setVendorLimitRows((rows) => [...rows, { vendor: "", limit: "" }]);
  }
  function updateVendorLimitRow(
    idx: number,
    patch: Partial<{ vendor: string; limit: string }>,
  ) {
    setVendorLimitRows((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  }
  function removeVendorLimitRow(idx: number) {
    setVendorLimitRows((rows) => rows.filter((_, i) => i !== idx));
  }
  function applyTemplate(t: PolicyTemplate) {
    setDailyCap(t.dailyCap.toFixed(2));
    setPerTxLimit(t.perTxLimit.toFixed(2));
    setVendorsRaw(t.vendors.join("\n"));
    setVendorLimitRows(
      Object.entries(t.vendorLimits).map(([vendor, limit]) => ({
        vendor,
        limit: String(limit),
      })),
    );
  }
  function handleTemplateChange(id: string) {
    setTemplate(id);
    const t = POLICY_TEMPLATES.find((p) => p.id === id);
    if (t) applyTemplate(t);
  }
  function buildVendorLimits(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const row of vendorLimitRows) {
      const vendor = row.vendor.trim().toLowerCase();
      const amount = Number(row.limit);
      if (!vendor) continue;
      if (!Number.isFinite(amount) || amount <= 0) continue;
      out[vendor] = Math.round(amount * 100) / 100;
    }
    return out;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const vendorLimits = buildVendorLimits();
      const payload: Record<string, unknown> = {
        name,
        authorizedBy,
        dailyCap: Number(dailyCap),
        perTxLimit: Number(perTxLimit),
        approvedVendors: vendorsRaw,
        expiresAt: new Date(expiresAt).toISOString(),
      };
      // Always send vendorLimits in edit mode so unchecking the last row clears
      // them server-side; in create mode skip if empty so we don't store a
      // pointless empty object.
      if (isEdit) {
        payload.vendorLimits = vendorLimits;
      } else if (Object.keys(vendorLimits).length > 0) {
        payload.vendorLimits = vendorLimits;
      }
      if (!isEdit) {
        payload.parentAgentId = parentAgentId || undefined;
      }

      const url = isEdit ? `/api/agents/${agentId}` : "/api/agents";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const result = (await res.json()) as { id: string };
      const targetId = isEdit ? agentId! : result.id;
      router.push(`/agents/${targetId}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEdit
            ? "Failed to update agent"
            : "Failed to register agent",
      );
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {!isEdit && (
        <Field
          label="Start from a template"
          hint="Optional — picks sensible starting values for daily cap, per-tx limit, approved vendors, and per-vendor limits. Every field stays editable."
        >
          <select
            value={template}
            onChange={(e) => handleTemplateChange(e.target.value)}
            className={inputClass}
          >
            <option value="">— Start from scratch —</option>
            {POLICY_TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} — {t.description}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Agent name" hint="Display name shown in the dashboard.">
        <input
          required
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Research Agent"
          className={inputClass}
        />
      </Field>

      <Field label="Authorized by" hint="Email of the developer or human operator.">
        <input
          required
          type="email"
          value={authorizedBy}
          onChange={(e) => setAuthorizedBy(e.target.value)}
          placeholder="you@company.com"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Daily cap (USD)" hint="Total spend allowed per UTC day.">
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={dailyCap}
            onChange={(e) => setDailyCap(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Per-transaction limit (USD)" hint="Maximum amount per single payment.">
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={perTxLimit}
            onChange={(e) => setPerTxLimit(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Approved vendors"
        hint="One per line. Payments to anything else trigger an escalation."
      >
        <textarea
          required
          value={vendorsRaw}
          onChange={(e) => setVendorsRaw(e.target.value)}
          rows={5}
          className={`${inputClass} font-mono text-xs`}
        />
      </Field>

      <Field
        label="Per-vendor daily limits"
        hint="Optional — leave empty to use global limits only. When set, today's spend with that specific vendor cannot exceed this limit, on top of the global daily cap."
      >
        <div className="flex flex-col gap-2">
          {vendorLimitRows.length === 0 && (
            <p className="text-xs text-[var(--muted)]">No per-vendor limits configured.</p>
          )}
          {vendorLimitRows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="exa.ai"
                value={row.vendor}
                onChange={(e) => updateVendorLimitRow(idx, { vendor: e.target.value })}
                className={`${inputClass} flex-1 font-mono text-xs`}
              />
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="$ per day"
                value={row.limit}
                onChange={(e) => updateVendorLimitRow(idx, { limit: e.target.value })}
                className={`${inputClass} w-32`}
              />
              <button
                type="button"
                onClick={() => removeVendorLimitRow(idx)}
                aria-label="Remove vendor limit"
                className="rounded-md border border-[var(--border)] px-2.5 py-2 text-xs text-[var(--muted)] hover:bg-black/[.04] dark:hover:bg-white/[.04]"
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addVendorLimitRow}
            className="self-start rounded-md border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-black/[.04] dark:hover:bg-white/[.04]"
          >
            + Add vendor limit
          </button>
        </div>
      </Field>

      <Field label="Expires at" hint="After this time the credential will no longer be valid.">
        <input
          required
          type="datetime-local"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className={inputClass}
        />
      </Field>

      {!isEdit && (
        <Field
          label="Parent agent"
          hint="If this agent was hired by another agent, pick the parent. Leave blank for top-level."
        >
          <select
            value={parentAgentId}
            onChange={(e) => setParentAgentId(e.target.value)}
            className={inputClass}
          >
            <option value="">— None (top-level) —</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.id.slice(0, 8)}…
              </option>
            ))}
          </select>
        </Field>
      )}

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link
          href={backHref}
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm hover:bg-black/[.04] dark:hover:bg-white/[.04]"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting
            ? isEdit
              ? "Saving…"
              : "Registering…"
            : isEdit
              ? "Save changes"
              : "Register agent"}
        </button>
      </div>
    </form>
  );
}
