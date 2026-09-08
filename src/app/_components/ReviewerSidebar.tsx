import { SidebarLink } from "@/app/_components/ui/SidebarLink";
import { SidebarShell } from "@/app/_components/ui/SidebarShell";
import { SignOutButton } from "@/app/(reviewer)/sign-out-button";

/**
 * "v2" briefing-document redesign (confirmed 2026-08-31) — reviewer-side
 * counterpart to AppSidebar.tsx, same visual system (spec point 1 doesn't
 * name the reviewer nav explicitly, but item 14 lists "all reviewer-side
 * pages" as in scope, so the same left-sidebar treatment is applied here
 * by extension — flagged). No group labels: the reviewer nav has five
 * flat, equally-weighted destinations (Home/Queue/All requests/Companies/
 * Ideas), unlike the client sidebar's three genuinely distinct concept
 * groups (Intelligence/Diagnose/Execution) — inventing groups for five
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
 * Regulatory tracker summary REMOVED from here (confirmed 2026-09-08,
 * final status-flow spec, item 7) — it lived here specifically because no
 * real reviewer landing page existed yet at the time ("/queue itself is
 * the reviewer's landing page, so that suggested alternative doesn't
 * actually exist as a separate entity" — see this file's own prior
 * docblock, no longer true). Now that /home is real and IS that page, the
 * summary moved there entirely, not duplicated in both places.
 *
 * "Home" added as the first nav item (confirmed 2026-09-08) — the new
 * post-login landing page (see reviewer-login/actions.ts and page.tsx),
 * listed first since it's now the natural default destination; "Queue"
 * stays exactly where it was, second, unchanged and fully reachable.
 */
export function ReviewerSidebar({ displayName }: { displayName: string }) {
  return (
    <SidebarShell mobileLabel="Elvanis">
      <div className="px-4 pb-3 pt-5">
        <p className="text-base font-semibold text-neutral-900">ELVANIS</p>
        <p className="text-xs text-neutral-500">Reviewer tools</p>
      </div>
      <div className="border-t border-neutral-200" />

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-4">
        <SidebarLink href="/home">Home</SidebarLink>
        <SidebarLink href="/queue">Queue</SidebarLink>
        <SidebarLink href="/requests">All requests</SidebarLink>
        <SidebarLink href="/companies">Companies</SidebarLink>
        <SidebarLink href="/ideas">Ideas</SidebarLink>
        <SidebarLink href="/admin/regulatory-frameworks">Regulatory frameworks</SidebarLink>
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
