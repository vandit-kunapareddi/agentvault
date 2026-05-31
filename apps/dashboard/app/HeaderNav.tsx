"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

interface SummaryResponse {
  pendingEscalations: number;
}

const LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Transactions", href: "/transactions" },
  { label: "Escalations", href: "/escalations", badge: "pendingEscalations" as const },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HeaderNav() {
  const pathname = usePathname() ?? "/";
  const [pendingEscalations, setPendingEscalations] = useState<number | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    async function tick() {
      try {
        const res = await fetch("/api/summary", { cache: "no-store" });
        const json = (await res.json()) as SummaryResponse;
        if (!cancelled) setPendingEscalations(json.pendingEscalations);
      } catch {
        // next tick retries
      }
    }
    tick();
    const id = setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm sm:gap-6">
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href);
        const showBadge =
          link.badge === "pendingEscalations" &&
          pendingEscalations !== null &&
          pendingEscalations > 0;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`relative inline-flex items-center gap-1.5 transition ${
              active
                ? "font-semibold text-[var(--accent)]"
                : "hover:text-[var(--accent)]"
            }`}
          >
            {link.label}
            {showBadge && (
              <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">
                {pendingEscalations}
              </span>
            )}
          </Link>
        );
      })}
      <Link
        href="/agents/new"
        className={`whitespace-nowrap rounded-md px-3 py-1.5 transition ${
          isActive(pathname, "/agents/new")
            ? "bg-[var(--accent)] text-white opacity-100 ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--background)]"
            : "bg-[var(--accent)] text-white hover:opacity-90"
        }`}
      >
        Register Agent
      </Link>
      <ThemeToggle />
    </nav>
  );
}
