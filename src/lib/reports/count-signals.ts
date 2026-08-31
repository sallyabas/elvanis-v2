import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * "v2" briefing-document redesign (confirmed 2026-08-31) — the sidebar spec
 * calls for a real "Signals ●[count if >0]" badge, matching this codebase's
 * "never fabricate a bug fix / never invent tracking that doesn't exist"
 * discipline: rather than build a new "unread since last visit" concept
 * (which would need its own persisted last-seen timestamp and is a real
 * feature decision, not a visual one — out of scope for a visual-layer-only
 * pass), this counts exactly what the Signals page itself would show right
 * now — the same two queries `SignalsPage` runs, reduced to counts only.
 * Deliberately kept as its own small, cheap function (count-only selects,
 * no content) rather than reusing SignalsPage's own full data-loading path,
 * since this runs on every authenticated page load via the shared layout.
 */
export async function countSignalsItems(supabase: SupabaseClient, companyId: string): Promise<number> {
  const { data: latestReport } = await supabase
    .from("reports")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "sent")
    .order("delivered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let count = 0;

  if (latestReport) {
    const { count: findingCount } = await supabase
      .from("lens_findings")
      .select("id", { count: "exact", head: true })
      .eq("report_id", latestReport.id)
      .in("reviewer_status", ["approved", "edited"]);
    count += findingCount ?? 0;
  }

  const { data: moduleRequests } = await supabase.from("module_requests").select("id").eq("company_id", companyId).eq("status", "sent");

  for (const request of moduleRequests ?? []) {
    const { count: moduleFindingCount } = await supabase
      .from("module_findings")
      .select("id", { count: "exact", head: true })
      .eq("request_id", request.id)
      .in("reviewer_status", ["approved", "edited"]);
    count += moduleFindingCount ?? 0;
  }

  return count;
}
