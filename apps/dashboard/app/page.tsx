import Link from "next/link";

const GITHUB_URL = "https://github.com/vanditkunapareddi-jpg/agentvault";

const STEPS = [
  {
    n: 1,
    title: "Self-host the checkpoint",
    body: "Clone the repo and deploy your own checkpoint, dashboard, and Postgres. Generate a JWT secret and (optionally) a wallet for real on-chain settlement.",
  },
  {
    n: 2,
    title: "Register an agent",
    body: "From your dashboard, register an agent with its spending rules — daily cap, per-tx limit, approved vendors, per-vendor limits. You get back a signed JWT credential to hand to the agent.",
  },
  {
    n: 3,
    title: "The agent calls vault.pay()",
    body: "Your agent calls vault.pay({endpoint, maxAmount}). The checkpoint verifies the credential, runs the trust + budget pipeline, escalates anything unusual, and routes to the right protocol handler.",
  },
];

const FEATURES = [
  {
    title: "Universal protocol router",
    body: "One SDK shape, any agentic payment protocol. Today: x402 with real Base Sepolia settlement when you supply a wallet. MPP is a basic one-shot flow. ACP is recognised and logged but not yet executed.",
  },
  {
    title: "Pluggable trust layer",
    body: "Vendor-neutral TrustProvider interface. SimpleTrustProvider ships as the default; external identity, reputation, or behavioural providers can be added behind the same interface without touching the pipeline.",
  },
  {
    title: "Budget enforcement",
    body: "Daily caps, per-transaction limits, and per-vendor daily limits — all enforced by an external checkpoint, not inside the agent's own code where a compromised agent could bypass them.",
  },
  {
    title: "Cross-agent spending tree",
    body: "When agents hire sub-agents, every payment in the chain rolls up into one live view with full attribution and live health indicators.",
  },
  {
    title: "Human-in-the-loop escalation",
    body: "Unusual payments pause, fire a Slack notification (with HMAC-verified Approve/Block buttons), and wait for a decision. No response in 60s → auto-block. Never fails open.",
  },
  {
    title: "Live dashboard + suggestions",
    body: "Spending tree, transaction log, forecasts, and actionable suggestions surfaced from block and escalation patterns — all updating as payments happen.",
  },
];

const QUICKSTART = `git clone https://github.com/vanditkunapareddi-jpg/agentvault
cd agentvault
npm install
docker compose up -d                   # local Postgres
cp .env.example .env                    # then set JWT_SECRET
npm run db:migrate:deploy
npm run seed                            # optional — demo agents + transactions
npm run dev                             # checkpoint :4000, dashboard :3000`;

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-20 sm:gap-24">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 pt-6 text-center sm:pt-12">
        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
          Open source · self-host today
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          A trust and control layer for AI-agent payments.
        </h1>
        <p className="max-w-2xl text-base text-[var(--muted)] sm:text-lg">
          An open-source checkpoint that sits between your AI agents and any
          agentic payment protocol. Verifies credentials, enforces budgets,
          gives you cross-agent visibility, and pauses anything unusual for a
          human to approve.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            View on GitHub →
          </a>
          <Link
            href="/dashboard"
            className="rounded-md border border-[var(--border)] px-5 py-2.5 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.04]"
          >
            Browse the demo dashboard
          </Link>
        </div>
      </section>

      {/* Honest status callout */}
      <section className="rounded-lg border border-[var(--border)] bg-black/[.02] p-5 dark:bg-white/[.03]">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Project status
        </h2>
        <p className="mt-2 text-sm leading-relaxed">
          AgentVault is open source and <strong>self-host today</strong> —
          there is no hosted SaaS yet. To use it in production you clone the
          repo and run your own checkpoint, dashboard, and Postgres. The
          dashboard linked above is a public demo of one self-hosted instance.
          The SDK is a workspace package inside the monorepo; it is{" "}
          <strong>not yet published to npm</strong>. See the README for
          exactly what works end-to-end today versus what is still mocked or
          stubbed.
        </p>
      </section>

      {/* Why */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Why it exists
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <p className="text-base leading-relaxed">
            Multiple agentic payment protocols have shipped in the last twelve
            months — x402, MPP, ACP, and more on the way. Each is real and
            solves a different slice of how a payment moves.
          </p>
          <p className="text-base leading-relaxed text-[var(--muted)]">
            None of them answer the question a developer actually cares about:
            should this agent be trusted to make this payment, is it within
            budget, what is my whole agent ecosystem spending, and can I step
            in before something unusual goes through? AgentVault is the layer
            above that adds the governance — across protocols, through one
            interface.
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

      {/* Quickstart */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
          Self-host quickstart
        </h2>
        <div className="rounded-lg border border-[var(--border)] p-6">
          <p className="text-sm">
            Local Postgres, both apps running in dev mode, optional demo data.
            About five minutes from clone to a working dashboard at{" "}
            <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">
              http://localhost:3000
            </code>
            .
          </p>
          <pre className="mt-3 overflow-x-auto rounded-md bg-black/[.03] p-4 font-mono text-xs dark:bg-white/[.03]">
            {QUICKSTART}
          </pre>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Full instructions for deploying to Vercel + Railway, enabling
            real x402 settlement on Base Sepolia, and wiring up Slack
            escalations are in the{" "}
            <a
              href={`${GITHUB_URL}#self-host-quickstart`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--foreground)]"
            >
              README
            </a>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              View on GitHub →
            </a>
            <Link
              href="/dashboard"
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.04]"
            >
              Browse demo dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-col items-center gap-2 pb-8 text-xs text-[var(--muted)]">
        <p>AgentVault — open-source trust and control for AI-agent payments.</p>
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
