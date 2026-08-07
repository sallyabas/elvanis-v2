import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ensureClientUserRow } from "../client-login/actions";
import { SignOutButton } from "./sign-out-button";

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
      {/* Charcoal nav — confirmed brand identity 2026-08-06 ("headers/nav/
          dark surfaces" is the charcoal color's stated role). This one
          shared layout renders on every client-facing page, so this single
          change is the highest-leverage piece of "consistent branding
          across the internal app." */}
      <div className="flex items-center justify-between bg-neutral-900 px-6 py-2 text-sm text-neutral-300">
        <div className="flex items-center gap-6">
          <span className="font-semibold tracking-tight text-neutral-50">Elvanis</span>
          <nav className="flex gap-4">
            <Link href="/dashboard" className="hover:text-neutral-50 hover:underline">
              Dashboard
            </Link>
            <Link href="/business-profile" className="hover:text-neutral-50 hover:underline">
              Business Profile
            </Link>
            <Link href="/reports" className="hover:text-neutral-50 hover:underline">
              Reports &amp; History
            </Link>
            <Link href="/account-settings" className="hover:text-neutral-50 hover:underline">
              Account Settings
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span>{user.email}</span>
          <SignOutButton />
        </div>
      </div>
      {children}
    </div>
  );
}
