import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";

// Internal-only reviewer area (Reviewer Queue + Reviewer Workspace) —
// confirmed 2026-08-01, a fifth internal area alongside the four
// client-facing pages (Account Settings, Business Profile, Reports &
// History, Dashboard). Uses the service-role client for data, never
// client-scoped RLS — this is the reviewer's own tooling, not something a
// client account can reach.
//
// Real access control, confirmed 2026-08-02: session required, and the
// session's own `users.role` must be "reviewer" (see
// scripts/grant-reviewer.ts — the only way that role is ever granted, never
// hardcoded here). Unauthenticated visitors are redirected to
// /reviewer-login; authenticated-but-wrong-role visitors see an explicit
// denial rather than a silent redirect loop, since redirecting back to
// /reviewer-login while already signed in as the wrong account is
// confusing, not helpful.
export default async function ReviewerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/reviewer-login");
  }

  const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();

  if (profile?.role !== "reviewer") {
    return (
      <div className="mx-auto max-w-sm px-6 py-20 text-center">
        <p className="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          {user.email} is signed in but does not have reviewer access.
        </p>
        <SignOutButton />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-6 py-2 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
        <span>Internal reviewer tools — signed in as {user.email}</span>
        <SignOutButton />
      </div>
      {children}
    </div>
  );
}
