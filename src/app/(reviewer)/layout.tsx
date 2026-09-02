import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "./sign-out-button";
import { ReviewerSidebar } from "@/app/_components/ReviewerSidebar";
import { formatDisplayName } from "@/lib/format-display-name";

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

  const { data: profile } = await supabase.from("users").select("role, name").eq("id", user.id).maybeSingle();

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
      {/* "v2" briefing-document redesign (confirmed 2026-08-31) — same
          left-sidebar treatment as the client (app) layout, applied by
          extension per item 14 ("all reviewer-side pages"), so the
          internal reviewer tooling reads as the same product, not a
          visually separate admin panel. Responsive margin (confirmed
          2026-09-02) mirrors the client layout's own fix exactly — see
          that layout's comment for the full reasoning. */}
      <ReviewerSidebar displayName={formatDisplayName(profile?.name as string | null, user.email)} />
      <div className="min-h-screen bg-[#f9f9f9] pt-14 lg:ml-[200px] lg:pt-0">{children}</div>
    </div>
  );
}
