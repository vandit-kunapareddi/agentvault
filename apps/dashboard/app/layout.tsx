import type { Metadata } from "next";
import Link from "next/link";
import { HeaderNav } from "./HeaderNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentVault — Universal payment & control layer for AI agents",
  description:
    "One SDK for any agentic payment protocol. Trust verification, budget enforcement, per-vendor limits, cross-agent spend visibility, and human escalation built in.",
};

// Applied before first paint so the user-selected theme (or system fallback)
// is in place when React renders — prevents a flash of the wrong theme.
const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');var dark=t==='dark'||(t==null&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.add(dark?'dark':'light');}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <header className="border-b border-[var(--border)]">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-semibold tracking-tight"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 text-[var(--accent)]"
                aria-hidden
              >
                <rect x="3" y="4" width="18" height="16" rx="2" />
                <circle cx="12" cy="12" r="3.5" />
                <line x1="12" y1="12" x2="14.5" y2="14.5" />
              </svg>
              AgentVault
            </Link>
            <HeaderNav />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
          {children}
        </main>
      </body>
    </html>
  );
}
