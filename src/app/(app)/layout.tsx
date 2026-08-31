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
  const { data: company } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
  if (!company) {
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
          ml-[200px] on the content wrapper below reserves the sidebar's
          own width so content never renders underneath it. */}
      <AppSidebar displayName={displayName} signalsCount={signalsCount} />
      <div className="ml-[200px] min-h-screen bg-[#f9f9f9]">{children}</div>
    </div>
  );
}
