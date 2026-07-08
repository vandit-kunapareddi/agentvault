"use client";

import { useEffect, useState } from "react";

/**
 * A looping, self-contained animation for the landing hero. It mimics the
 * checkpoint's real job: payment requests from agents stream in, most pass the
 * trust + budget pipeline (green "Approved"), and occasionally an unusual one
 * is flagged amber and paused for a human to approve.
 *
 * Pure React + CSS, no dependencies, no assets. Themed with the same CSS vars
 * as the rest of the dashboard and disabled for prefers-reduced-motion users.
 */

type Verdict = "approved" | "flagged";

type Event = {
  id: number;
  agent: string;
  vendor: string;
  amount: string;
  verdict: Verdict;
  reason: string;
};

// A deterministic script so the story reads well every loop: a run of normal
// approvals, then one that trips a rule and gets flagged.
const SCRIPT: Omit<Event, "id">[] = [
  { agent: "research-bot", vendor: "api.serp.dev", amount: "$0.40", verdict: "approved", reason: "within budget" },
  { agent: "ops-agent", vendor: "twilio.com", amount: "$2.10", verdict: "approved", reason: "approved vendor" },
  { agent: "research-bot", vendor: "api.openai.com", amount: "$1.25", verdict: "approved", reason: "within budget" },
  { agent: "growth-agent", vendor: "unknown-vendor.io", amount: "$180.00", verdict: "flagged", reason: "over per-tx limit · new vendor" },
  { agent: "ops-agent", vendor: "aws.amazon.com", amount: "$6.80", verdict: "approved", reason: "approved vendor" },
  { agent: "data-agent", vendor: "scrape.sh", amount: "$0.90", verdict: "approved", reason: "within budget" },
  { agent: "growth-agent", vendor: "ads.example.net", amount: "$95.00", verdict: "flagged", reason: "daily cap exceeded" },
  { agent: "research-bot", vendor: "api.serp.dev", amount: "$0.40", verdict: "approved", reason: "within budget" },
];

const MAX_ROWS = 5;
const TICK_MS = 1600;

export default function CheckpointFeed() {
  const [events, setEvents] = useState<Event[]>([]);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) {
      // Show a static snapshot instead of animating.
      setEvents(
        SCRIPT.slice(0, MAX_ROWS).map((e, i) => ({ ...e, id: i })),
      );
      return;
    }

    let i = 0;
    let idSeq = 0;
    const push = () => {
      const next = SCRIPT[i % SCRIPT.length];
      i += 1;
      idSeq += 1;
      const event = { ...next, id: idSeq };
      setEvents((prev) => [event, ...prev].slice(0, MAX_ROWS));
    };

    push();
    const timer = setInterval(push, TICK_MS);
    return () => clearInterval(timer);
  }, [reduced]);

  return (
    <div className="w-full max-w-xl rounded-xl border border-[var(--border)] bg-black/[.02] p-4 dark:bg-white/[.03]">
      {/* Header row: the checkpoint label + a live pulse */}
      <div className="flex items-center justify-between px-1 pb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
          <span className="relative flex h-2 w-2">
            {!reduced && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" />
            )}
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" />
          </span>
          AgentVault checkpoint
        </div>
        <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
          live
        </span>
      </div>

      {/* Feed */}
      <ul className="flex flex-col gap-2" aria-label="Live payment checkpoint feed">
        {events.map((e) => (
          <li
            key={e.id}
            className={[
              "av-feed-row flex items-center gap-3 rounded-lg border px-3 py-2 text-left",
              e.verdict === "flagged"
                ? "border-amber-400/60 bg-amber-400/10"
                : "border-[var(--border)] bg-[var(--background)]",
            ].join(" ")}
          >
            {/* Verdict icon */}
            <span
              className={[
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                e.verdict === "flagged"
                  ? "bg-amber-400/20 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              ].join(" ")}
              aria-hidden
            >
              {e.verdict === "flagged" ? "!" : "✓"}
            </span>

            {/* Agent → vendor */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span className="truncate">{e.agent}</span>
                <span className="text-[var(--muted)]">→</span>
                <span className="truncate text-[var(--muted)]">{e.vendor}</span>
              </div>
              <div
                className={[
                  "text-[11px]",
                  e.verdict === "flagged"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-[var(--muted)]",
                ].join(" ")}
              >
                {e.verdict === "flagged"
                  ? `Flagged · ${e.reason} · awaiting approval`
                  : `Approved · ${e.reason}`}
              </div>
            </div>

            {/* Amount */}
            <span className="shrink-0 font-mono text-xs tabular-nums">
              {e.amount}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
