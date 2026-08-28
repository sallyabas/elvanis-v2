import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Whether a Path B ('ai_audit') company has finished its onboarding setup
 * — confirmed 2026-08-28, fix for a real, confirmed dead-end: once the
 * 5-field minimal profile is saved, `entry_path` is committed to
 * 'ai_audit' immediately (see path-b-actions.ts's submitPathBMinimalProfile()),
 * well before the triage/recommendation steps ever run. A client who
 * refreshes, navigates away, or restarts their browser at any point after
 * that but before finishing triage+recommendation was previously
 * redirected straight to /business-profile with no trace back into the
 * flow and no visible next step — silently stranded (confirmed via live
 * testing: hard refresh, browser-back navigation, and — by the same
 * mechanism, since nothing here is tab/process-scoped — a browser restart
 * all produced the identical outcome).
 *
 * "Done" means the client acted on the deterministic recommendation:
 * either a real module request exists (any status — they picked a module
 * off the recommendation screen), or a compliance_consultation session
 * request exists (they picked "talk to a human" instead). The 3 triage
 * answers themselves are NOT treated as sufficient — per the founder's own
 * confirmed decision, this fix does not attempt to resume mid-triage state,
 * only to stop the dead-end, so a client who answered triage but never
 * proceeded past the recommendation screen still counts as "not done" and
 * is routed back to redo the (short) triage screen.
 *
 * MUST be called with the admin client, not the caller's session-scoped
 * one — module_requests' own RLS only lets a client SELECT `sent` rows
 * (supabase/migrations/20260806090000_module_requests_rls_fix.sql), so a
 * session-scoped check here would incorrectly report "not done" for a
 * client whose module request already exists but is still pending_review
 * or approved — worse than not checking at all, since it would keep
 * nagging someone who already acted.
 */
export async function hasCompletedPathBSetup(admin: SupabaseClient, companyId: string): Promise<boolean> {
  const [{ count: moduleCount }, { count: consultationCount }] = await Promise.all([
    admin.from("module_requests").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    admin
      .from("session_requests")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("session_type", "compliance_consultation"),
  ]);
  return (moduleCount ?? 0) > 0 || (consultationCount ?? 0) > 0;
}
