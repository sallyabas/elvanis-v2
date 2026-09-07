import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeJourneyStatus } from "@/lib/reports/journey-status";
import { NextStepBanner } from "@/app/_components/NextStepBanner";
import { ProgressStepper } from "@/app/_components/ProgressStepper";
import { type ItemType, sessionTypeToItemType } from "@/lib/item-type-badge";
import { SESSION_STATUS_LABELS } from "@/lib/format";
import { loadServiceStatusRecords } from "@/lib/reviewer/service-status";
import { CONTACT_SALES_SESSION_TYPES, CONTACT_SALES_STATUS_LABELS } from "@/lib/reviewer/service-status-types";
import { ReportsHistoryClient, type HistoryItem } from "./ReportsHistoryClient";

/**
 * Reports & History — full redesign (confirmed 2026-08-26), same
 * research-informed treatment as the Dashboard redesign. Real gap found in
 * the previous version: everything (Core Audit, 3 modules, Execution
 * Sprints, 3 session types — 8 distinct item types) rendered as one flat
 * list distinguished only by a plain-text label, no visual differentiation
 * at all.
 *
 * Checked real sources before deciding, not just opinion (same discipline
 * as the Dashboard pass): list-design and activity-feed guidance
 * consistently recommend (a) a consistent visual marker per item type so
 * mixed lists stay scannable "at a glance," and (b) grouping by category
 * when items are genuinely heterogeneous, while preserving chronological
 * order *within* each group when recency/audit-trail matters — this page's
 * own subtitle already promises a chronological record, so grouping
 * doesn't replace that, it sits on top of it. Sources:
 * https://www.uxpin.com/studio/blog/list-design/,
 * https://www.eleken.co/blog-posts/list-ui-design,
 * https://getstream.io/blog/activity-feed-design/,
 * https://uxpatterns.dev/patterns/data-display/timeline.
 *
 * Structure decided from that research:
 * 1. A colored type badge per item (see `@/lib/item-type-badge`, extracted
 *    2026-08-26 so /queue, /requests, /signals, and /company/[companyId]
 *    could reuse the exact same type/color system rather than each
 *    inventing their own) —
 *    chosen over a new icon set specifically to match this app's own
 *    already-established "colored badge as differentiator" pattern
 *    (severity badges, plan-tier badges, missing-evidence badges) rather
 *    than introducing a new icon library/dependency or hand-drawn SVGs for
 *    a genuinely new visual pattern this app doesn't otherwise use.
 * 2. Two real sections — "Deliverables" (Core Audit, the 3 modules,
 *    completed Execution Sprints: the actual substantive things Elvanis
 *    produced) and "Sessions" (Discovery/Delivery/F2F Workshop history) —
 *    replacing the one mixed list. This is the part of the redesign that
 *    most directly matches the founder's own framing ("real deliverables
 *    separated from session activity"). A section with zero items simply
 *    doesn't render its heading, rather than showing an empty group.
 * 3. Execution Sprints: confirmed present in both the code AND live
 *    rendering (see the verification note below) — the previous version's
 *    subtitle claim was accurate, not a stale promise.
 *
 * Everything else (RLS-enforced `status = 'sent'` filtering, the Discovery-
 * Session-shows-in-any-state rule, Digital Presence Scan's absence,
 * comparison-over-time being V2) is unchanged from the previous version —
 * this redesign only touches presentation, not what's included or why.
 */
export default async function ReportsHistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  const { data: company } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
  if (!company) {
    redirect("/onboarding");
  }

  const { data: reports } = await supabase
    .from("reports")
    .select("id, delivered_at")
    .eq("company_id", company.id)
    .eq("status", "sent")
    .order("delivered_at", { ascending: false });

  const { data: moduleRequests } = await supabase
    .from("module_requests")
    .select("id, module_type, delivered_at")
    .eq("company_id", company.id)
    .eq("status", "sent")
    .order("delivered_at", { ascending: false });

  // Session requests — real rule, confirmed 2026-08-15: a Discovery Session
  // lives here in ANY state (requested/scheduled/completed/declined), since
  // it never shows on Dashboard at all (see dashboard/page.tsx's own
  // docblock for why). Every other session type (Delivery, F2F Workshop)
  // only lands here once it's reached a terminal state (completed/
  // declined) — while requested/scheduled, it's genuinely active and
  // already shown on Dashboard instead; showing it in both places would be
  // real duplication, not "more complete history."
  const { data: allSessionRequests } = await supabase
    .from("session_requests")
    .select("id, session_type, status, requested_at, scheduled_at, completed_at, reviewer_notes")
    .eq("company_id", company.id)
    .order("requested_at", { ascending: false });
  const historicalSessionRequests = (allSessionRequests ?? []).filter(
    (r) =>
      // Concierge/Training & Advisory excluded here (confirmed 2026-09-07,
      // Contact Sales flow) — their real terminal status lives in
      // service_status_records now (loaded separately below), never
      // session_requests.status, which is permanently frozen at
      // 'requested' for these two types going forward.
      !CONTACT_SALES_SESSION_TYPES.includes(r.session_type as (typeof CONTACT_SALES_SESSION_TYPES)[number]) &&
      (r.session_type === "discovery" || r.status === "completed" || r.status === "declined"),
  );

  // Contact Sales (Concierge/Training & Advisory) history, confirmed
  // 2026-09-07 — "a completed, refunded, or canceled booking must remain
  // visible to the client permanently." Their real terminal status source
  // is service_status_records, not session_requests.status.
  const { data: contactSalesSessionRows } = await supabase
    .from("session_requests")
    .select("id, session_type, requested_at")
    .eq("company_id", company.id)
    .in("session_type", [...CONTACT_SALES_SESSION_TYPES])
    .order("requested_at", { ascending: false });
  const contactSalesStatusRecords = await loadServiceStatusRecords(
    "session_request",
    (contactSalesSessionRows ?? []).map((r) => r.id as string),
  );
  const historicalContactSalesRequests = (contactSalesSessionRows ?? [])
    .map((r) => ({ ...r, record: contactSalesStatusRecords.get(r.id as string) }))
    .filter((r) => r.record?.status === "completed" || r.record?.status === "canceled" || r.record?.status === "refunded");

  // Execution Sprints — only `complete` (terminal) lands here; `scoped`/
  // `in_progress`/`proposed` stay Dashboard-only, same reasoning as module
  // requests above (non-terminal = Dashboard's job, terminal = History's
  // job). Confirmed 2026-08-26 this genuinely renders live, not just
  // present in code — see this file's own docblock.
  const { data: completeSprints } = await supabase
    .from("execution_sprints")
    .select("id, signed_off_at, target_end_date")
    .eq("company_id", company.id)
    .eq("status", "complete")
    .order("signed_off_at", { ascending: false, nullsFirst: false });

  // Real gap fixed, confirmed 2026-08-12 (live testing) — the empty state
  // here was a single bare, unstyled line ("Nothing delivered yet.") with
  // no visual weight and no next-step guidance, unlike Dashboard/Business
  // Profile/Evidence Intake, which all replaced the same class of gap with
  // NextStepBanner back on 2026-08-07. Same computeJourneyStatus() single
  // source of truth as those pages (admin client required — see that
  // function's own docblock for why a session-scoped query would silently
  // misreport an in-review company as no_evidence).
  const journeyStatus = await computeJourneyStatus(createAdminClient(), company.id as string);

  const deliverables: HistoryItem[] = [
    ...(reports ?? []).map((r) => ({
      id: r.id as string,
      type: "core_audit" as const,
      group: "deliverable" as const,
      subLabel: null,
      date: r.delivered_at as string | null,
      dateLabel: "Delivered",
      href: `/reports/${r.id}`,
      reviewerNotes: null,
    })),
    ...(moduleRequests ?? []).map((r) => ({
      id: r.id as string,
      type: (r.module_type === "ai_reliability" ? "ai_reliability" : r.module_type === "tender_readiness" ? "tender_readiness" : "data_protection") as ItemType,
      group: "deliverable" as const,
      subLabel: null,
      date: r.delivered_at as string | null,
      dateLabel: "Delivered",
      // Real gap closed (confirmed 2026-08-15, real bug list item #6) — a
      // real client-facing detail view now exists; this previously showed
      // "Detail view coming soon" with no link at all.
      href: `/services/module/${r.id}`,
      reviewerNotes: null,
    })),
    ...(completeSprints ?? []).map((s) => ({
      id: s.id as string,
      type: "execution_sprint" as const,
      group: "deliverable" as const,
      subLabel: "Complete",
      date: (s.signed_off_at as string | null) ?? (s.target_end_date as string | null),
      dateLabel: s.signed_off_at ? "Signed off" : "Target end",
      href: `/execution-sprint/${s.id}`,
      reviewerNotes: null,
    })),
  ].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

  const sessions: HistoryItem[] = [
    ...historicalSessionRequests.map((r) => {
      const date = (r.completed_at as string | null) ?? (r.scheduled_at as string | null) ?? (r.requested_at as string | null);
      const dateLabel = r.completed_at ? "Completed" : r.scheduled_at ? "Scheduled" : "Requested";
      // Real bug found and fixed while adding training_advisory (confirmed
      // 2026-09-05) — this was a hand-rolled ternary duplicating the exact
      // "map a session_type to its badge identity" logic
      // sessionTypeToItemType() already exists specifically to prevent
      // from drifting (the same class of silent-fallback-to-f2f_workshop
      // bug already caught once for concierge_inquiry, see that helper's
      // own history) — this local copy was never updated when that fix
      // landed. Now reads from the one shared source of truth instead of
      // a second, independently-drifting copy.
      const type: ItemType = sessionTypeToItemType(r.session_type as string);
      return {
        id: r.id as string,
        type,
        group: "session" as const,
        subLabel: SESSION_STATUS_LABELS[r.status as string] ?? (r.status as string),
        date,
        dateLabel,
        // No dedicated client-facing session detail page exists yet — same
        // "real, deliberately deferred follow-on scope" precedent as
        // module results before their own detail view was built.
        href: null,
        // Real reviewer completion/outcome note (confirmed 2026-08-31,
        // sidebar rework item 15) — session_requests.reviewer_notes,
        // already captured by the reviewer at completion time, surfaced
        // here for the first time via the existing field/mechanism, not a
        // new one.
        reviewerNotes: (r.reviewer_notes as string | null) ?? null,
      };
    }),
    // Contact Sales (Concierge/Training & Advisory) terminal history,
    // confirmed 2026-09-07 — same shape, sourced from service_status_records
    // instead of session_requests. reason (cancel/refund) shown the same
    // way a decline reason already is above.
    ...historicalContactSalesRequests.map((r) => {
      // Filtered above to completed/canceled/refunded only — always a
      // real terminal status by construction here.
      const status = r.record!.status;
      return {
        id: r.id as string,
        type: sessionTypeToItemType(r.session_type as string),
        group: "session" as const,
        subLabel: CONTACT_SALES_STATUS_LABELS[status],
        date: r.record?.completedAt ?? (r.requested_at as string | null),
        dateLabel: CONTACT_SALES_STATUS_LABELS[status],
        href: null,
        reviewerNotes: r.record?.reason ?? r.record?.note ?? null,
      };
    }),
  ].sort((a, b) => new Date(b.date ?? 0).getTime() - new Date(a.date ?? 0).getTime());

  const isEmpty = deliverables.length === 0 && sessions.length === 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <ProgressStepper journeyStatus={journeyStatus} />
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Reports &amp; History</h1>
      <p className="mb-8 text-sm text-neutral-500">
        Every report, module result, and completed sprint you&apos;ve received, plus your session history — grouped
        so real deliverables and calls with your reviewer don&apos;t blur together.
      </p>

      {isEmpty ? <NextStepBanner journeyStatus={journeyStatus} /> : <ReportsHistoryClient deliverables={deliverables} sessions={sessions} />}
    </div>
  );
}
