"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * "v2" briefing-document redesign (confirmed 2026-08-31, spec point 1) —
 * the shared active-link primitive for both the client sidebar
 * (AppSidebar.tsx) and the reviewer sidebar (ReviewerSidebar.tsx).
 * Deliberately a left-border + wash-background active state (not the prior
 * pass's bottom-border underline — NavLink.tsx, now unused by either
 * layout since both moved from a top bar to a sidebar) per the spec's
 * exact wording: "copper left border 3px + very light copper background
 * wash, text #1a1a1a weight 500." Hover only applies when not already
 * active, matching the spec's separate "hover state: #f5f5f4 background,
 * no border change" line — an active item's own border/wash already reads
 * as its "current" state and shouldn't flicker to the plain hover tone.
 */
export function SidebarLink({ href, children, badge }: { href: string; children: ReactNode; badge?: ReactNode }) {
  const pathname = usePathname();
  const isActive = pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-2 border-l-[3px] px-3 py-1.5 text-sm transition-colors ${
        isActive ? "border-accent bg-[#fdf6ee] font-medium text-neutral-900" : "border-transparent font-normal text-neutral-700 hover:bg-neutral-100"
      }`}
    >
      <span className="truncate">{children}</span>
      {badge}
    </Link>
  );
}
