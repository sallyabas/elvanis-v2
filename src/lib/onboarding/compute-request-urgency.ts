import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Confirmed 2026-08-27 (Onboarding Architecture & Path Routing brief,
 * Part 3/8f) — reads the company's own already-stored triage answer
 * rather than requiring the onboarding UI to hand-carry an `is_urgent`
 * flag through to whichever module intake page it eventually lands on.
 * Deliberately a live read at module-request creation time, not a value
 * threaded through client state — a real submission could happen well
 * after triage (a client can return to `/tender-readiness` later), and
 * the company's own current triage answer is the honest source of truth
 * for "is there an active request right now," same "read the current
 * profile, never a cached copy" principle used everywhere else in this
 * codebase.
 *
 * Only ever meaningful for Tender Readiness today — the deterministic
 * routing in path-b-routing.ts never marks AI Reliability Audit or Data
 * Protection Compliance urgent, so this helper is currently only wired
 * into that one module's persist.ts. Kept as its own small function
 * rather than inlined so a future module can reuse it identically.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function isCompanyRequestUrgent(supabase: SupabaseClient<any>, companyId: string): Promise<boolean> {
  const { data } = await supabase.from("companies").select("triage_compliance_request").eq("id", companyId).maybeSingle();
  return (data as { triage_compliance_request: string | null } | null)?.triage_compliance_request === "active_request";
}
