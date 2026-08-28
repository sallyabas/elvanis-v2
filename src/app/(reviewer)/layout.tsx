import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";
import { NavLink } from "@/app/_components/ui/NavLink";

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
      {/* Premium B2B redesign (confirmed 2026-08-28, spec point 5) — same
          white-bar/bottom-border/active-underline treatment as the client
          (app) layout, so the internal reviewer tooling reads as the same
          product, not a visually separate admin panel. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 bg-white px-6 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-wrap items-center gap-5">
          <span className="font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Elvanis</span>
          {/* Real nav links (confirmed 2026-08-25) — the first time this
              layout has needed one, now that there's more than one
              reviewer-only page reachable from /queue's own internal
              links alone. */}
          <NavLink href="/queue">Queue</NavLink>
          <NavLink href="/requests">All requests</NavLink>
          {/* Real nav link added 2026-08-26 (navigation audit) — reverses
              the earlier "hold, queue-only" decision on a company
              directory; see companies/page.tsx's own docblock. */}
          <NavLink href="/companies">Companies</NavLink>
          <NavLink href="/ideas">Ideas</NavLink>
        </div>
        <span className="flex items-center gap-3 text-neutral-600 dark:text-neutral-400">
          <span>signed in as {user.email}</span>
          <SignOutButton />
        </span>
      </div>
      {children}
    </div>
  );
}
