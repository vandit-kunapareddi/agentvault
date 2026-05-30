import type { Metadata } from "next";
import Link from "next/link";
import { HeaderNav } from "./HeaderNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentVault — Universal payment & control layer for AI agents",
  description:
    "One SDK for any agentic payment protocol. Trust verification, budget enforcement, per-vendor limits, cross-agent spend visibility, and human escalation built in.",
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
            <HeaderNav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">{children}</main>
      </body>
    </html>
  );
}
