import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Reviewer Home page — Clients widget (confirmed 2026-09-08, final
 * status-flow spec, item 7). "Total number of all clients, plus a
 * 'recently active' count — defined specifically as clients who have paid
 * for a service or received a report (not general login/profile
 * activity)."
 *
 * "Received a report" = a real `reports.status = 'sent'` row (Core Audit
 * or re-audit alike — both use the same table/status), timestamped by its
 * own `delivered_at`. "Paid for a service" = the new `paid_at` timestamp
 * on module_requests/execution_sprints/pending_evidence_submissions
 * (confirmed 2026-09-08, this same spec, item 7's own `paid_at` bullet —
 * built specifically so this widget, and the Requests widget's own
 * 'paid' rollup, has a real payment moment to read instead of
 * approximating off an unrelated column), plus Contact Sales' own
 * `service_status_records.updated_at` for the moment a Concierge/
 * Training & Advisory request reached 'booked'/'completed'/'refunded' —
 * its own status change IS the payment confirmation (same reasoning as
 * requests-summary.ts's own docblock), and unlike the three payment-
 * gated tables it has no dedicated `paid_at` column of its own;
 * `updated_at` is the closest real signal available, not a fabricated
 * one — disclosed as an approximation, not overclaimed as exact.
 *
 * Deliberately NOT counting session logins, profile edits, or evidence
 * submitted but not yet paid/delivered — the brief's own explicit
 * "not general login/profile activity" carve-out.
 *
 * service_status_records is polymorphic (entity_type/entity_id, no real
 * FK Supabase could embed-join on) — its own company link only exists by
 * first resolving entity_id back to session_requests.company_id, a real,
 * separate two-step query, same pattern already used elsewhere in this
 * codebase for this exact table.
 */

const RECENTLY_ACTIVE_WINDOW_DAYS = 30; // same convention already established by /companies' own recency filter chips, reused here for consistency rather than inventing a second window definition.

export interface ClientsSummary {
  totalClients: number;
  recentlyActiveClients: number;
  recentlyActiveWindowDays: number;
}

export async function loadClientsSummary(): Promise<ClientsSummary> {
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - RECENTLY_ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: totalClients }, { data: reports }, { data: moduleRequests }, { data: sprints }, { data: pendingReaudits }, { data: bookedStatusRecords }] =
    await Promise.all([
      admin.from("companies").select("id", { count: "exact", head: true }),
      admin.from("reports").select("company_id").eq("status", "sent").gte("delivered_at", cutoff),
      admin.from("module_requests").select("company_id").gte("paid_at", cutoff),
      admin.from("execution_sprints").select("company_id").gte("paid_at", cutoff),
      admin.from("pending_evidence_submissions").select("company_id").gte("paid_at", cutoff),
      admin.from("service_status_records").select("entity_id").eq("entity_type", "session_request").in("status", ["booked", "completed", "refunded"]).gte("updated_at", cutoff),
    ]);

  const activeCompanyIds = new Set<string>();
  for (const r of reports ?? []) activeCompanyIds.add(r.company_id as string);
  for (const m of moduleRequests ?? []) activeCompanyIds.add(m.company_id as string);
  for (const s of sprints ?? []) activeCompanyIds.add(s.company_id as string);
  for (const p of pendingReaudits ?? []) activeCompanyIds.add(p.company_id as string);

  const bookedSessionIds = (bookedStatusRecords ?? []).map((r) => r.entity_id as string);
  if (bookedSessionIds.length > 0) {
    const { data: sessionCompanies } = await admin.from("session_requests").select("company_id").in("id", bookedSessionIds);
    for (const s of sessionCompanies ?? []) activeCompanyIds.add(s.company_id as string);
  }

  return {
    totalClients: totalClients ?? 0,
    recentlyActiveClients: activeCompanyIds.size,
    recentlyActiveWindowDays: RECENTLY_ACTIVE_WINDOW_DAYS,
  };
}
