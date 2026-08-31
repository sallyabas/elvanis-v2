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

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
        <div>
          <SidebarLink href="/dashboard">Dashboard</SidebarLink>
        </div>

        <div>
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500">Intelligence</p>
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

        <div>
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500">Diagnose</p>
          <div className="space-y-0.5">
            <SidebarLink href="/evidence-intake">Business Diagnosis</SidebarLink>
          </div>
        </div>

        <div>
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500">AI &amp; Compliance</p>
          <div className="space-y-0.5">
            <SidebarLink href="/ai-audit">AI Audit</SidebarLink>
            <SidebarLink href="/tender-readiness">Tender Readiness</SidebarLink>
            <SidebarLink href="/ai-reliability-audit">AI Reliability</SidebarLink>
            <SidebarLink href="/data-protection-compliance">Data Protection</SidebarLink>
          </div>
        </div>

        <div>
          <p className="mb-1 px-3 text-[11px] font-medium uppercase tracking-[0.08em] text-neutral-500">Execution</p>
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
