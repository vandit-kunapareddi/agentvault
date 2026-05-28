"use client";

import { useState } from "react";

export function CredentialField({ value }: { value: string | null }) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return (
      <p className="text-sm text-[var(--muted)]">
        No credential issued yet. Re-register this agent to mint one.
      </p>
    );
  }

  async function copy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <code className="block break-all rounded-md border border-[var(--border)] bg-black/[.03] p-3 font-mono text-xs dark:bg-white/[.03]">
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        className="self-start rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
      >
        {copied ? "Copied!" : "Copy credential"}
      </button>
    </div>
  );
}
