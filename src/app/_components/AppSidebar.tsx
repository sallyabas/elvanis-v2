import Link from "next/link";
import { SidebarLink } from "@/app/_components/ui/SidebarLink";
import { SignOutButton } from "@/app/(app)/sign-out-button";

/**
 * Sidebar rework (confirmed 2026-08-31, direct founder spec, items 1-2) —
 * replaces the earlier "v2" redesign's DIAGNOSE/EXECUTION split with a real
 * AI & COMPLIANCE group: AI Audit plus all three named modules as four
 * equal sibling links, no parent/child nesting. "Business Diagnosis" moves
 * to its own single-item DIAGNOSE group (Business Diagnosis was
 * previously paired with "AI Audit" there in the prior pass — that
 * pairing is now retired in favor of this more specific grouping).
 *
 * "AI Audit" routes to /ai-audit (new — see that page's own docblock for
 * why it's a real, dedicated destination, not /onboarding or /services).
 * The three named modules route straight to their own intake pages,
 * skipping triage entirely (confirmed rule 3) — each of those pages now
 * shows its own confirm-before-starting screen first (ModuleStartConfirm,
 * item 6), so a direct sidebar click still never silently drops the
 * client into a bare form with zero context.
 */
export function AppSidebar({ displayName, signalsCount }: { displayName: string; signalsCount: number }) {
  return (
    <aside className="fixed inset-y-0 left-0 flex w-[200px] flex-col border-r border-neutral-200 bg-white">
      <div className="px-4 pb-3 pt-5">
        <p className="text-base font-semibold text-neutral-900">ELVANIS</p>
        <p className="text-xs text-neutral-500">AI Business OS</p>
      </div>
      <div className="border-t border-neutral-200" />

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        <div>
          <SidebarLink href="/dashboard">Dashboard</SidebarLink>
        </div>

        {/* Group-label contrast — second, stronger pass (confirmed
            2026-08-31, direct founder instruction: "not another subtle
            tweak"). The first pass (neutral-500->600, medium->semibold)
            was judged still insufficient. This one goes further on every
            axis at once: heading text is now the same #1a1a1a
            (neutral-900) used for page titles — genuinely dark, not a
            muted gray — at weight 600; the divider is darkened one step
            (neutral-200->300) to read as a real, clear line rather than a
            faint hairline; and the vertical rhythm is deliberately
            generous — pt-6 above the divider-to-heading gap, mb-3 below
            the heading before the first link — noticeably more than the
            prior pt-4/mb-1.5, so each group reads as its own visually
            separated block at a glance, not just a differently-colored
            label sitting close to its links. Still entirely inside the
            light-only/copper-only system — no new hue, just darker/
            heavier use of tokens already in the palette. */}
        <div className="border-t border-neutral-300 pt-6">
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-900">Intelligence</p>
          <div className="space-y-0.5">
            <SidebarLink href="/business-profile">Business Profile</SidebarLink>
            <SidebarLink
              href="/signals"
              badge={
                signalsCount > 0 ? (
                  <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">{signalsCount}</span>
                ) : undefined
              }
            >
              Signals
            </SidebarLink>
            <SidebarLink href="/reports">Reports &amp; History</SidebarLink>
          </div>
        </div>

        <div className="border-t border-neutral-300 pt-6">
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-900">Diagnose</p>
          <div className="space-y-0.5">
            <SidebarLink href="/evidence-intake">Business Diagnosis</SidebarLink>
          </div>
        </div>

        <div className="border-t border-neutral-300 pt-6">
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-900">AI &amp; Compliance</p>
          <div className="space-y-0.5">
            <SidebarLink href="/ai-audit">AI Audit</SidebarLink>
            <SidebarLink href="/tender-readiness">Tender Readiness</SidebarLink>
            <SidebarLink href="/ai-reliability-audit">AI Reliability</SidebarLink>
            <SidebarLink href="/data-protection-compliance">Data Protection</SidebarLink>
          </div>
        </div>

        <div className="border-t border-neutral-300 pt-6">
          <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-900">Execution</p>
          <div className="space-y-0.5">
            <SidebarLink href="/services">Services</SidebarLink>
          </div>
        </div>
      </nav>

      <div className="border-t border-neutral-200 px-3 py-3">
        <p className="mb-2 truncate text-xs text-neutral-500" title={displayName}>
          {displayName}
        </p>
        <div className="space-y-0.5">
          <Link href="/account-settings" className="block rounded px-1 py-1 text-sm text-neutral-700 hover:bg-neutral-100">
            Account Settings
          </Link>
          <div className="px-1">
            <SignOutButton />
          </div>
        </div>
      </div>
    </aside>
  );
}
