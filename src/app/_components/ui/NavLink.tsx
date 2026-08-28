"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Shared nav-link with a real active-state indicator (confirmed
 * 2026-08-28, premium B2B redesign, spec point 5: "copper for active
 * state indicator — a 2px bottom border under the active nav item, not a
 * background fill"). The two existing nav bars ((app)/layout.tsx,
 * (reviewer)/layout.tsx) had no active-route awareness at all before this
 * — a small, purely presentational addition (current route -> a visual
 * highlight), not a functional/routing change, so it's in scope for a
 * visual-layer-only pass. Needs "use client" (usePathname) even though
 * both consuming layouts are Server Components — same pattern already
 * established for LinkButton/button-variants: this file only exports the
 * one client component, nothing a Server Component needs to import a
 * plain value from.
 */
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
  return (
    <Link
      href={href}
      className={`border-b-2 pb-0.5 transition-colors ${
        isActive
          ? "border-accent text-neutral-900 dark:text-neutral-50"
          : "border-transparent text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-50"
      }`}
    >
      {children}
    </Link>
  );
}
