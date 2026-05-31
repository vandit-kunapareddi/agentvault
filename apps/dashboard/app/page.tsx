import Link from "next/link";

const GITHUB_URL = "https://github.com/vanditkunapareddi-jpg/agentvault";

const STEPS = [
  {
    n: 1,
    title: "Drop in the SDK",
    body: "Your agent calls vault.pay({endpoint, maxAmount}). Nothing else in your agent's code has to change.",
  },
  {
    n: 2,
    title: "AgentVault routes it",
    body: "The checkpoint detects which protocol the endpoint expects, verifies the agent's trust, enforces global and per-vendor budgets, and pauses anything unusual for a human to approve.",
  },
  {
    n: 3,
    title: "Payment settles",
    body: "Routes through the right protocol — x402, MPP, or ACP today; new protocols plug in behind the same interface. Every decision lands in the live dashboard in real time.",
  },
];

const FEATURES = [
  {
    title: "Universal protocol router",
    body: "One SDK, any agentic payment protocol. New protocols are added behind a single interface — your agent code never changes.",
  },
  {
    title: "Behavioural trust scoring",
    body: "Every payment is scored before it goes through. Every block, approval, and escalation feeds the platform's own trust dataset.",
  },
  {
    title: "Budget enforcement",
    body: "Daily caps, per-transaction limits, and per-vendor daily limits — enforced by an external checkpoint, not the agent itself.",
  },
  {
    title: "Cross-agent spending tree",
    body: "When agents hire sub-agents, every payment in the chain rolls up into one live view with full attribution.",
  },
  {
    title: "Human-in-the-loop escalation",
    body: "Unusual payments pause, fire a Slack notification, and wait for an Approve / Block decision. No response in 60s → auto-block. Never fails open.",
  },
  {
    title: "Live dashboard + suggestions",
    body: "Spending tree, transaction log, forecasts, and actionable suggestions from block and escalation patterns — all updating as payments happen.",
  },
];

const CODE_EXAMPLE = `import { AgentVault } from "@agentvault/sdk";

const vault = new AgentVault({
  credential: process.env.AGENT_CREDENTIAL!,
  checkpointUrl: process.env.AGENTVAULT_CHECKPOINT_URL,
});

const result = await vault.pay({
  endpoint: "https://api.exa.ai/search",
  maxAmount: 0.05,
});

if (result.status === "approved") {
  // use the receipt and call the vendor
}`;

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-20 sm:gap-24">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 pt-6 text-center sm:pt-12">
        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
          One SDK. Any protocol. Full control.
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          The universal payment and control layer for AI agents.
        </h1>
        <p className="max-w-2xl text-base text-[var(--muted)] sm:text-lg">
          One SDK that lets your agent pay across any agentic payment protocol,
          with trust verification, budget enforcement, per-vendor limits,
          cross-agent spend visibility, and human escalation built in.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard"
            className="rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Open dashboard
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-[var(--border)] px-5 py-2.5 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.04]"
          >
            View on GitHub →
          </a>
        </div>
      </section>

      {/* Why */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Why it exists
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <p className="text-base leading-relaxed">
            In the last twelve months, multiple agentic payment protocols have
            shipped — x402, MPP, ACP, and more on the way. Each is real,
            production-bound, and solves a slightly different slice of the
            problem.
          </p>
          <p className="text-base leading-relaxed text-[var(--muted)]">
            But every developer building an AI agent now has to integrate them
            separately, manage the differences, and figure out for themselves
            whether an agent should be trusted to make any given payment at all.
            AgentVault is the layer above that abstracts the protocols and adds
            the governance — so you integrate once and get trust, budgets, and
            human oversight for free.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          How it works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="rounded-lg border border-[var(--border)] p-5"
            >
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--accent)]">
                Step {s.n}
              </div>
              <h3 className="mt-1 text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          What it does
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-lg border border-[var(--border)] p-5"
            >
              <h3 className="text-sm font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Get started */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Get started
        </h2>
        <div className="rounded-lg border border-[var(--border)] p-6">
          <p className="text-sm">
            Spin up the live dashboard, register your first agent, mint a
            spending credential, and watch payments flow through.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-black/[.03] p-4 font-mono text-xs dark:bg-white/[.03]">
            {CODE_EXAMPLE}
          </pre>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/agents/new"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Register your first agent →
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.04]"
            >
              Open dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-col items-center gap-2 pb-8 text-xs text-[var(--muted)]">
        <p>AgentVault — one SDK, any protocol, full control.</p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-[var(--foreground)]"
        >
          github.com/vanditkunapareddi-jpg/agentvault
        </a>
      </footer>
    </div>
  );
}
