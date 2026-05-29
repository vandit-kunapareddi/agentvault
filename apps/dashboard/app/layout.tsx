import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentVault",
  description: "Trust and control layer for AI agents making x402 payments.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <header className="border-b border-[var(--border)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-block h-6 w-6 rounded bg-[var(--accent)]" aria-hidden />
              AgentVault
            </Link>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:gap-6">
              <Link href="/" className="hover:text-[var(--accent)]">
                Dashboard
              </Link>
              <Link href="/transactions" className="hover:text-[var(--accent)]">
                Transactions
              </Link>
              <Link href="/escalations" className="hover:text-[var(--accent)]">
                Escalations
              </Link>
              <Link
                href="/agents/new"
                className="whitespace-nowrap rounded-md bg-[var(--accent)] px-3 py-1.5 text-white hover:opacity-90"
              >
                Register Agent
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</main>
      </body>
    </html>
  );
}
