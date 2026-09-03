import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureClientUserRow } from "../client-login/actions";
import { SignOutButton } from "./sign-out-button";
import { AppSidebar } from "@/app/_components/AppSidebar";
import { formatDisplayName } from "@/lib/format-display-name";
import { countSignalsItems } from "@/lib/reports/count-signals";

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
  //
  // Real gap closed (confirmed 2026-09-03, direct founder-reproduced bug):
  // this gate previously only checked "does a company row exist," not
  // whether it's actually complete. A bare row (name only, entry_path:
  // 'undecided') gets created early as a side effect of the Hub bridge
  // step (createCompanyMinimal(), see onboarding/actions.ts) — before
  // that row existed at all, this gate correctly redirected away, but the
  // instant it exists, every sidebar link became clickable with zero real
  // profile data on record. Every OTHER path that sets entry_path writes
  // it atomically alongside all of that path's own required fields
  // (createCompanyAndGoal/addGoalToExistingCompany/
  // submitPathBMinimalProfile all confirmed by direct code read) — so
  // `entry_path === 'undecided'` is both necessary and sufficient here,
  // no per-field check needed. Deliberately does NOT touch the separate,
  // already-correct case of an existing, fully-onboarded client who later
  // switches focus via chooseEntryPath() and hasn't finished the new
  // path's fields yet — that's handled by its own dedicated "Finish
  // setting up" banner (hasCompletedPathBSetup()), a soft nudge, not a
  // hard block, and stays that way.
  const { data: company } = await supabase.from("companies").select("id, entry_path").eq("user_id", user.id).maybeSingle();
  if (!company || !company.entry_path || company.entry_path === "undecided") {
    redirect("/onboarding");
  }

  // Both real (not decorative) — display name (spec point 1: "if none set,
  // show first part of email before @; never show the full raw email
  // address") and the Signals badge count (spec point 1: "●[count if >0]").
  const { data: userRow } = await supabase.from("users").select("name").eq("id", user.id).maybeSingle();
  const displayName = formatDisplayName(userRow?.name as string | null, user.email);
  const signalsCount = await countSignalsItems(supabase, company.id as string);

  return (
    <div>
      {/* "v2" briefing-document redesign (confirmed 2026-08-31, spec point
          1) — replaces the previous top nav bar with a fixed left sidebar.
          lg:ml-[200px] on the content wrapper below reserves the sidebar's
          own width at desktop so content never renders underneath it.
          Below `lg` (confirmed 2026-09-02, mobile-responsiveness fix): no
          left margin — the sidebar itself becomes an off-canvas drawer
          (see SidebarShell.tsx) — and pt-14 clears its own fixed mobile
          top bar instead. */}
      <AppSidebar displayName={displayName} signalsCount={signalsCount} />
      <div className="min-h-screen bg-[#f9f9f9] pt-14 lg:ml-[200px] lg:pt-0">{children}</div>
    </div>
  );
}
