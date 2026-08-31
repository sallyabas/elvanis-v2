import Link from "next/link";
import { SidebarLink } from "@/app/_components/ui/SidebarLink";
import { SignOutButton } from "@/app/(app)/sign-out-button";

/**
 * "v2" briefing-document redesign (confirmed 2026-08-31, spec point 1) —
 * replaces the previous top nav bar entirely. Exact structure/labels/
 * grouping per the brief, verbatim: ELVANIS wordmark + "AI Business OS"
 * subtitle, Dashboard on its own, then three labeled groups (INTELLIGENCE /
 * DIAGNOSE / EXECUTION), then a footer with display name + Account
 * Settings + Sign out.
 *
 * "Business Diagnosis" and "AI Audit" are always rendered — no
 * `entry_path` branching here at all, per the brief's explicit
 * instruction ("no conditional hiding, no client ever locked into seeing
 * only one... entry_path continues to determine only the Dashboard's lead
 * section, never nav visibility"). Real interpretation, flagged: neither
 * label is an existing single page — "Business Diagnosis" links to
 * /evidence-intake (the real start/continue action for a Core Audit,
 * previously labeled "Submit Evidence" in this same nav slot) and
 * "AI Audit" links to /services (the real, existing start/continue action
 * for any of the three standalone modules, regardless of entry_path or
 * whether Path B triage was ever completed) — both are genuine, already-
 * built destinations, not new pages invented for this nav.
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
            <SidebarLink href="/services">AI Audit</SidebarLink>
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
