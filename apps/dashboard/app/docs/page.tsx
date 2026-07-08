import Link from "next/link";
import type { Metadata } from "next";

const GITHUB_URL = "https://github.com/vandit-kunapareddi/agentvault";

export const metadata: Metadata = {
  title: "Docs — AgentVault",
  description:
    "How to self-host AgentVault, register agents, call vault.pay(), configure the checkpoint, and extend it with your own protocol handlers and trust providers.",
};

// Sidebar entries — each id matches a <section id="..."> below.
const NAV = [
  { id: "introduction", label: "Introduction" },
  { id: "status", label: "What works today" },
  { id: "how-it-works", label: "How it works" },
  { id: "quickstart", label: "Self-host quickstart" },
  { id: "credential", label: "Spending credential" },
  { id: "sdk", label: "SDK usage" },
  { id: "configuration", label: "Configuration" },
  { id: "extending", label: "Extending" },
  { id: "resources", label: "Further reading" },
];

const STATUS_ROWS: { cap: string; state: string; works: boolean }[] = [
  { cap: "Checkpoint decision pipeline (verify → trust → limits → escalation)", state: "Works end-to-end", works: true },
  { cap: "Human-in-the-loop escalation (60s hold, Slack approve/block, auto-block on timeout)", state: "Works end-to-end, incl. HMAC-verified Slack callbacks", works: true },
  { cap: "Dashboard (spending tree, live log, escalation queue, charts, forecasts)", state: "Works end-to-end", works: true },
  { cap: "x402 protocol handler", state: "Real EIP-3009 USDC settlement on Base Sepolia when a wallet is set; mock receipts otherwise", works: true },
  { cap: "MPP protocol handler", state: "Basic one-shot only — sessions, streaming, subscriptions not implemented", works: false },
  { cap: "ACP protocol handler", state: "Detected and logged (settled: false) — full checkout execution not implemented", works: false },
  { cap: "TrustProvider interface + SimpleTrustProvider", state: "Works as the default; external providers plug in behind the same interface", works: true },
  { cap: "npm packages (-sdk, -types, -trust)", state: "Published — v0.1.0", works: true },
  { cap: "Hosted multi-tenant SaaS", state: "Not built — each user runs their own deployment", works: false },
];

const CONFIG_ROWS: { name: string; purpose: string }[] = [
  { name: "DATABASE_URL", purpose: "Postgres connection string" },
  { name: "JWT_SECRET", purpose: "Signs and verifies spending credentials. Must match between dashboard and checkpoint" },
  { name: "MIN_TRUST_SCORE", purpose: "Minimum trust score (0–100) an agent must clear to transact" },
  { name: "ESCALATION_TIMEOUT_MS", purpose: "How long a held payment waits before auto-blocking (default 60000)" },
  { name: "ESCALATION_RATE_LIMIT", purpose: "Max escalations from one agent per hour before further payments auto-escalate (default 3)" },
  { name: "SLACK_WEBHOOK_URL", purpose: "Optional — sends escalation notifications to Slack" },
  { name: "SLACK_SIGNING_SECRET", purpose: "Optional — verifies Slack interactive callbacks (HMAC)" },
  { name: "CHECKPOINT_INTERNAL_URL", purpose: "Where the dashboard forwards escalation resolutions" },
  { name: "DASHBOARD_URL", purpose: "Used for the \"open dashboard\" link in Slack messages" },
  { name: "WALLET_PRIVATE_KEY", purpose: "Optional — when set, the x402 handler signs real EIP-3009 USDC transfers on Base Sepolia" },
];

const PIPELINE = [
  "Credential — verify the JWT signature → tampered → block",
  "Expiry — credential expired → block",
  "Trust gate — agent's trust score below MIN_TRUST_SCORE → block",
  "Per-transaction limit — amount over perTxLimit → block",
  "Vendor whitelist — vendor not in approvedVendors → escalate",
  "Per-vendor daily limit — today's vendor spend + amount over the per-vendor cap → block",
  "Daily budget — today's total + amount over dailyCap → block",
  "Near-cap — projected spend ≥ 90% of daily cap → escalate",
  "Never-seen vendor — first-ever payment to an approved vendor → escalate",
  "Escalation rate limit — more than ESCALATION_RATE_LIMIT escalations in the last hour → escalate",
  "Route — approved payments dispatch to the matching protocol handler and return a receipt",
];

const QUICKSTART = `git clone https://github.com/vandit-kunapareddi/agentvault
cd agentvault
npm install
docker compose up -d                   # local Postgres
cp .env.example .env                    # then set JWT_SECRET
npm run db:migrate:deploy
npm run db:generate
npm run seed                            # optional — demo agents + transactions
npm run dev                             # checkpoint :4000, dashboard :3000`;

const CREDENTIAL = `{
  "agentId": "clx123abc",
  "agentName": "Research Agent",
  "walletAddress": "0x52ce…",
  "authorizedBy": "developer@example.com",
  "dailyCap": 10.0,
  "perTxLimit": 0.5,
  "approvedVendors": ["exa.ai", "hyperbolic.xyz"],
  "vendorLimits": { "exa.ai": 2.0, "hyperbolic.xyz": 3.0 },
  "supportedProtocols": ["x402", "mpp", "acp"],
  "issuedAt": 1748390400,
  "expiresAt": 1748476800
}`;

const SDK_USAGE = `import { AgentVault } from "@vanditk2/agentvault-sdk";

const vault = new AgentVault({
  credential: process.env.AGENT_CREDENTIAL!, // signed JWT from your dashboard
  checkpointUrl: "http://localhost:4000",
});

// The agent never has to know which protocol the service speaks.
const result = await vault.pay({
  endpoint: "https://api.someservice.com/data",
  maxAmount: 0.05,
});

if (result.status === "approved") {
  // result.protocol, result.receipt, result.trustTier
}`;

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-md bg-black/[.03] p-4 font-mono text-xs leading-relaxed dark:bg-white/[.03]">
      {children}
    </pre>
  );
}

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2
      id={id}
      className="scroll-mt-24 text-lg font-semibold tracking-tight sm:text-xl"
    >
      {children}
    </h2>
  );
}

export default function DocsPage() {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
      {/* Sidebar */}
      <aside className="lg:w-56 lg:shrink-0">
        <div className="lg:sticky lg:top-24">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Documentation
          </p>
          <nav className="flex flex-col gap-1 text-sm">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="rounded-md px-2 py-1 text-[var(--muted)] transition hover:bg-black/[.04] hover:text-[var(--foreground)] dark:hover:bg-white/[.04]"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              View source on GitHub →
            </a>
          </div>
        </div>
      </aside>

      {/* Content */}
      <article className="min-w-0 flex-1 space-y-14">
        <header className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Documentation
          </h1>
          <p className="text-base text-[var(--muted)]">
            Everything you need to self-host AgentVault, register agents, and
            route their payments through the checkpoint. AgentVault is{" "}
            <strong className="text-[var(--foreground)]">
              open source and self-host today
            </strong>{" "}
            — there is no hosted SaaS yet.
          </p>
        </header>

        {/* Introduction */}
        <section className="space-y-3">
          <SectionHeading id="introduction">Introduction</SectionHeading>
          <p className="text-sm leading-relaxed">
            AgentVault is a trust and control layer for autonomous AI-agent
            payments. You drop one SDK into your agent and it can pay services
            across multiple agentic payment protocols, with credential-based
            budget enforcement, cross-agent spend visibility, and
            human-in-the-loop escalation — all enforced by an external
            checkpoint, not inside the agent&apos;s own code.
          </p>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            When you give an agent the ability to spend money, three gaps
            appear that none of the underlying payment protocols address: limits
            that live inside the agent go with it if the agent is compromised,
            sub-agents spend invisibly, and there is no way to pause a payment
            and ask &ldquo;did you mean to do this?&rdquo; before it executes.
            An independent checkpoint enforces rules outside the agent, a live
            spending tree shows the full hierarchy, and unusual payments pause
            for human approval.
          </p>
        </section>

        {/* Status */}
        <section className="space-y-3">
          <SectionHeading id="status">What works today</SectionHeading>
          <p className="text-sm leading-relaxed">
            Being explicit about the current state so you know exactly what
            you&apos;re getting:
          </p>
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <tbody>
                {STATUS_ROWS.map((row) => (
                  <tr
                    key={row.cap}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <td className="p-3 align-top">{row.cap}</td>
                    <td className="p-3 align-top text-[var(--muted)]">
                      <span
                        className={[
                          "mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                          row.works
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : "bg-amber-400/15 text-amber-600 dark:text-amber-400",
                        ].join(" ")}
                      >
                        {row.works ? "Ready" : "Partial"}
                      </span>
                      {row.state}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[var(--muted)]">
            If any of these gaps are blockers for you, please{" "}
            <a
              href={`${GITHUB_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--foreground)]"
            >
              open an issue
            </a>{" "}
            — they&apos;re all on the roadmap.
          </p>
        </section>

        {/* How it works */}
        <section className="space-y-3">
          <SectionHeading id="how-it-works">How it works</SectionHeading>
          <p className="text-sm leading-relaxed">
            The agent calls <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">vault.pay()</code>.
            The SDK detects the protocol from the endpoint and forwards the
            request to your checkpoint, which runs each payment through an
            ordered pipeline. Every step short-circuits — a failure blocks or
            escalates immediately:
          </p>
          <ol className="space-y-2 text-sm">
            {PIPELINE.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[11px] font-semibold text-[var(--accent)]">
                  {i + 1}
                </span>
                <span className="text-[var(--muted)]">{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            An escalated payment is <strong className="text-[var(--foreground)]">held</strong> for{" "}
            <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">ESCALATION_TIMEOUT_MS</code>{" "}
            (default 60s) while a human decides in Slack or the dashboard. If no
            decision arrives in time it auto-blocks — it never fails open.
          </p>
        </section>

        {/* Quickstart */}
        <section className="space-y-3">
          <SectionHeading id="quickstart">Self-host quickstart</SectionHeading>
          <p className="text-sm leading-relaxed">
            You&apos;ll need Node 20+, npm 9+, a Postgres database (local Docker
            or hosted), and a long random string for{" "}
            <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">JWT_SECRET</code>.
            About five minutes from clone to a working dashboard at{" "}
            <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">http://localhost:3000</code>.
          </p>
          <CodeBlock>{QUICKSTART}</CodeBlock>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            To enable real x402 settlement, run{" "}
            <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">npm run wallet:bootstrap</code>,
            fund the printed address from the Base Sepolia and Circle USDC
            faucets, and set{" "}
            <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">WALLET_PRIVATE_KEY</code>{" "}
            in your{" "}
            <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">.env</code>.
            Full instructions for deploying to Vercel + Railway are in the{" "}
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
        </section>

        {/* Credential */}
        <section className="space-y-3">
          <SectionHeading id="credential">Spending credential</SectionHeading>
          <p className="text-sm leading-relaxed">
            Each agent gets a signed JWT that travels with it. The rules live in
            the credential, not in the agent&apos;s own code. You issue one from
            the dashboard when you register an agent.
          </p>
          <CodeBlock>{CREDENTIAL}</CodeBlock>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Per-vendor{" "}
            <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">vendorLimits</code>{" "}
            are applied on top of the global{" "}
            <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">dailyCap</code>.
            A payment is blocked if either is exceeded.
          </p>
        </section>

        {/* SDK */}
        <section className="space-y-3">
          <SectionHeading id="sdk">SDK usage</SectionHeading>
          <p className="text-sm leading-relaxed">
            Install{" "}
            <a
              href="https://www.npmjs.com/package/@vanditk2/agentvault-sdk"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--foreground)]"
            >
              <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">@vanditk2/agentvault-sdk</code>
            </a>. The SDK talks to a checkpoint — until a hosted version exists,
            that means self-hosting this repo and pointing{" "}
            <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">checkpointUrl</code>{" "}
            at your deployment.
          </p>
          <CodeBlock>{SDK_USAGE}</CodeBlock>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">pay()</code>{" "}
            probes the endpoint to detect the protocol, then routes the request
            through your checkpoint, which verifies trust, enforces budget
            rules, escalates if needed, and dispatches to the right protocol
            handler.
          </p>
        </section>

        {/* Configuration */}
        <section className="space-y-3">
          <SectionHeading id="configuration">Configuration</SectionHeading>
          <p className="text-sm leading-relaxed">
            All configuration is via{" "}
            <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">.env</code>{" "}
            (see{" "}
            <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">.env.example</code>).
          </p>
          <div className="overflow-hidden rounded-lg border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <tbody>
                {CONFIG_ROWS.map((row) => (
                  <tr
                    key={row.name}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <td className="p-3 align-top">
                      <code className="whitespace-nowrap rounded bg-black/[.05] px-1.5 py-0.5 text-xs dark:bg-white/[.08]">
                        {row.name}
                      </code>
                    </td>
                    <td className="p-3 align-top text-[var(--muted)]">
                      {row.purpose}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Extending */}
        <section className="space-y-3">
          <SectionHeading id="extending">Extending</SectionHeading>
          <p className="text-sm leading-relaxed">
            Two extension points keep the rest of the checkpoint untouched.
          </p>
          <div className="space-y-4">
            <div className="rounded-lg border border-[var(--border)] p-4">
              <h3 className="text-sm font-semibold">Protocol handlers</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Add a new agentic payment protocol or replace a built-in mock.
                The router is a string-keyed registry; external code calls{" "}
                <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">registerHandler(&quot;ap2&quot;, myHandler)</code>{" "}
                and the checkpoint routes to it with no pipeline changes.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-4">
              <h3 className="text-sm font-semibold">Trust providers</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Swap{" "}
                <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">SimpleTrustProvider</code>{" "}
                for a custom one (on-chain reputation, behavioural model,
                in-house service) by implementing the small{" "}
                <code className="rounded bg-black/[.05] px-1 py-0.5 text-xs dark:bg-white/[.08]">TrustProvider</code>{" "}
                interface and changing one line in the checkpoint.
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-4">
              <h3 className="text-sm font-semibold">Webhooks</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Subscribe an external system to checkpoint events
                (transaction.approved, transaction.blocked, escalation
                lifecycle, and more). Each delivery is HMAC-signed. Manage
                subscriptions from the{" "}
                <Link href="/webhooks" className="underline hover:text-[var(--foreground)]">
                  Webhooks
                </Link>{" "}
                page.
              </p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-[var(--muted)]">
            Full guides with worked examples, error semantics, and gotchas:{" "}
            <a
              href={`${GITHUB_URL}/blob/main/docs/EXTENDING.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--foreground)]"
            >
              docs/EXTENDING.md
            </a>{" "}
            and{" "}
            <a
              href={`${GITHUB_URL}/blob/main/docs/WEBHOOKS.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--foreground)]"
            >
              docs/WEBHOOKS.md
            </a>
            . Two runnable reference implementations live in{" "}
            <a
              href={`${GITHUB_URL}/tree/main/examples`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--foreground)]"
            >
              examples/
            </a>
            .
          </p>
        </section>

        {/* Resources */}
        <section className="space-y-3">
          <SectionHeading id="resources">Further reading</SectionHeading>
          <ul className="space-y-2 text-sm">
            <li>
              <a href={`${GITHUB_URL}#readme`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                Full README
              </a>{" "}
              <span className="text-[var(--muted)]">— architecture, tech stack, roadmap</span>
            </li>
            <li>
              <a href={`${GITHUB_URL}/blob/main/docs/EXTENDING.md`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                docs/EXTENDING.md
              </a>{" "}
              <span className="text-[var(--muted)]">— writing protocol handlers and trust providers</span>
            </li>
            <li>
              <a href={`${GITHUB_URL}/blob/main/docs/WEBHOOKS.md`} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                docs/WEBHOOKS.md
              </a>{" "}
              <span className="text-[var(--muted)]">— event catalog and signature verification</span>
            </li>
            <li>
              <Link href="/dashboard" className="text-[var(--accent)] hover:underline">
                Live demo dashboard
              </Link>{" "}
              <span className="text-[var(--muted)]">— spending tree, transaction log, escalation queue</span>
            </li>
          </ul>
        </section>
      </article>
    </div>
  );
}
