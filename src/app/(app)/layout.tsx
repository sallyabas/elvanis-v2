import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureClientUserRow } from "../client-login/actions";
import { SignOutButton } from "./sign-out-button";
import { NavLink } from "@/app/_components/ui/NavLink";

// Authenticated app shell — shared nav/session-check across the four IA
// pages (Dashboard, Business Profile, Reports & History, Account
// Settings). Confirmed 2026-08-03: real client auth (magic-link + code,
// mirroring the reviewer-login pattern), replacing the interim
// `?companyId=`/`?goalId=` URL-addressing hack these pages previously used
// — that hack is retired from this layer; individual pages still need to
// switch from admin-client `?companyId=` lookups to session-derived,
// RLS-scoped queries as they're rebuilt (tracked separately, not done by
// this layout alone).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  // No DB trigger syncs auth.users -> public.users (confirmed by reading
  // the migrations directly) — this is the one place that gap is closed
  // for client accounts, on every authenticated request. Idempotent
  // (no-ops if the row already exists), and never overwrites an existing
  // role, so a reviewer account visiting a client page doesn't get
  // silently downgraded.
  await ensureClientUserRow(user.id, user.email ?? "");

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();

  if (profile?.role !== "client") {
    return (
      <div className="mx-auto max-w-sm px-6 py-20 text-center">
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          {user.email} is signed in but does not have client access (role: {profile?.role ?? "unknown"}).
        </p>
        <SignOutButton />
      </div>
    );
  }

  // Real Company/Goal creation (confirmed 2026-08-03, Priority 1) — a
  // signed-in client with no company yet is sent to /onboarding, which is
  // deliberately outside this route group (see onboarding/page.tsx) so
  // this redirect can never loop against itself.
  const { data: company } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
  if (!company) {
    redirect("/onboarding");
  }

  return (
    <div>
      {/* Premium B2B redesign (confirmed 2026-08-28, spec point 5) —
          replaces the previous charcoal nav with a white bar + bottom
          border, real active-route indicator (copper 2px underline, not a
          background fill — see NavLink.tsx) instead of the old uniform
          hover-only styling. Dark mode keeps a dark surface (unaffected by
          this pass, which is explicitly light-mode-only). */}
      <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-6">
          <span className="font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Elvanis</span>
          <nav className="flex gap-5">
            <NavLink href="/dashboard">Dashboard</NavLink>
            {/* Real nav link added 2026-08-26 (navigation audit) — Evidence
                Intake previously had no persistent nav entry at all; the
                only path was one small, narrowly-worded inline link on
                Dashboard ("Want to pursue a different goal? Submit new
                evidence...") that undersold what the page does the rest of
                the time (adding evidence to strengthen the same goal's
                audit, not just switching goals). Placed as a plain flat
                link, matching every other nav item's visual treatment,
                right after Dashboard since it's the natural next action. */}
            <NavLink href="/evidence-intake">Submit Evidence</NavLink>
            {/* Real nav link added 2026-08-16 (final Dashboard redesign,
                item 1) — Signals is a genuinely new, standalone page (a
                unified filterable finding list), not a duplicate of any
                existing page, so it gets its own top-level nav entry same
                as Services did. */}
            <NavLink href="/signals">Signals</NavLink>
            <NavLink href="/business-profile">Business Profile</NavLink>
            <NavLink href="/reports">Reports &amp; History</NavLink>
            {/* Real nav link added 2026-08-12, Dashboard rebuild — /services
                is now a real standalone page, not just linked from
                Dashboard; reachable from anywhere in the authenticated app. */}
            <NavLink href="/services">Services</NavLink>
            <NavLink href="/account-settings">Account Settings</NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-3 text-neutral-600 dark:text-neutral-400">
          <span>{user.email}</span>
          <SignOutButton />
        </div>
      </div>
      {children}
    </div>
  );
}
