import Link from "next/link";
import { SidebarLink } from "@/app/_components/ui/SidebarLink";
import { SidebarShell } from "@/app/_components/ui/SidebarShell";
import { SignOutButton } from "@/app/(reviewer)/sign-out-button";
import type { RegulatoryFrameworkStatusSummary } from "@/lib/reviewer/regulatory-frameworks";

/**
 * "v2" briefing-document redesign (confirmed 2026-08-31) — reviewer-side
 * counterpart to AppSidebar.tsx, same visual system (spec point 1 doesn't
 * name the reviewer nav explicitly, but item 14 lists "all reviewer-side
 * pages" as in scope, so the same left-sidebar treatment is applied here
 * by extension — flagged). No group labels: the reviewer nav has exactly
 * four flat, equally-weighted destinations (Queue/All requests/Companies/
 * Ideas), unlike the client sidebar's three genuinely distinct concept
 * groups (Intelligence/Diagnose/Execution) — inventing groups for four
 * items that don't actually cluster would be manufacturing structure the
 * brief didn't ask for.
 *
 * Footer display name (confirmed 2026-08-31, item 13) — same
 * formatDisplayName() treatment as the client sidebar, resolved by the
 * caller ((reviewer)/layout.tsx) from `users.name`/email, never the raw
 * email shown directly here.
 *
 * Mobile-responsive (confirmed 2026-09-02) — same real fix as
 * AppSidebar.tsx, same SidebarShell.tsx wrapper, same reasoning: this had
 * the identical unconditional `fixed w-[200px]` gap, squeezing every
 * reviewer-facing page below `lg` exactly like the client side did.
 *
 * Regulatory tracker summary (confirmed 2026-09-07) — placed here rather
 * than on /queue (1000+ lines, already flagged as an oversized file to
 * avoid growing further) or a distinct "reviewer dashboard" (no such page
 * exists — /queue itself is the reviewer's landing page, so that
 * suggested alternative doesn't actually exist as a separate entity).
 * The sidebar is the genuinely lower-risk choice: two small files
 * (this one, and the layout that fetches the summary), renders on every
 * reviewer page rather than one, and sits right next to the
 * "Regulatory frameworks" nav link it summarizes.
 */
export function ReviewerSidebar({ displayName, regulatorySummary }: { displayName: string; regulatorySummary: RegulatoryFrameworkStatusSummary }) {
  return (
    <SidebarShell mobileLabel="Elvanis">
      <div className="px-4 pb-3 pt-5">
        <p className="text-base font-semibold text-neutral-900">ELVANIS</p>
        <p className="text-xs text-neutral-500">Reviewer tools</p>
      </div>
      <div className="border-t border-neutral-200" />

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
        <SidebarLink href="/queue">Queue</SidebarLink>
        <SidebarLink href="/requests">All requests</SidebarLink>
        <SidebarLink href="/companies">Companies</SidebarLink>
        <SidebarLink href="/ideas">Ideas</SidebarLink>
        <SidebarLink href="/admin/regulatory-frameworks">Regulatory frameworks</SidebarLink>
        <Link
          href="/admin/regulatory-frameworks"
          className="block px-3 pb-1 pt-0.5 text-xs leading-relaxed text-neutral-500 transition-colors hover:text-neutral-700"
        >
          <span className="text-emerald-600">{regulatorySummary.green} current</span>
          {" · "}
          <span className="text-amber-600">{regulatorySummary.amber} due soon</span>
          {" · "}
          <span className="text-red-600">{regulatorySummary.red} overdue</span>
        </Link>
      </nav>

      <div className="border-t border-neutral-200 px-3 py-3">
        <p className="mb-2 truncate text-xs text-neutral-500" title={displayName}>
          {displayName}
        </p>
        <SignOutButton />
      </div>
    </SidebarShell>
  );
}
