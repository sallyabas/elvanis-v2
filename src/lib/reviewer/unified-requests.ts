import { createAdminClient } from "@/lib/supabase/admin";
import type { Severity } from "@/lib/lenses/types";
import { type ItemType, TYPE_LABELS, moduleTypeToItemType, sessionTypeToItemType } from "@/lib/item-type-badge";
import { humanizeStatus } from "@/lib/format";
import { computeSubmissionDisplayStage } from "@/lib/evidence/submission-status";

/**
 * Unified, filterable request list (confirmed 2026-08-25, direct founder
 * request) — one normalized view across every request type this app
 * tracks (Core Audit reports, standalone module requests, session/
 * Concierge requests, Execution Sprints), replacing the need to check
 * separate sections (Ready for review, Session requests, Sprint queue)
 * individually. Deliberately NOT a new table or a materialized view —
 * this reads the same source tables every other reviewer page already
 * reads, normalized in application code, since the four source shapes
 * are genuinely different (a session request has no severity; a report
 * has no "scheduled_at") and forcing them into one schema at the DB
 * layer would either lose real fields or need a lot of always-null
 * columns.
 *
 * Severity is only meaningful for audits/modules (they have findings);
 * sessions/sprints get `severity: null`, filtered out entirely by a
 * severity filter rather than mis-represented as "low". Severity per
 * audit/module is the single HIGHEST severity among its own
 * approved/edited findings — the same "worst case, not an average"
 * reasoning already used for isFixFirstCandidate()/next-priority.ts's own
 * SEVERITY_RANK, kept as a local copy here since that one isn't exported.
 */

export type UnifiedRequestType = "audit" | "module" | "session" | "sprint" | "reaudit_pending";

export interface UnifiedRequestRow {
  id: string;
  type: UnifiedRequestType;
  typeLabel: string;
  /**
   * Fine-grained badge identity (confirmed 2026-08-26, navigation-audit fix
   * batch, item 3) — `type` alone can't distinguish Tender Readiness from
   * AI Reliability Audit, or a Discovery Session from a Concierge inquiry,
   * both of which the shared `@/lib/item-type-badge` color system needs to
   * render a genuinely per-type badge instead of one flat color per coarse
   * `type`.
   */
  badgeType: ItemType;
  companyId: string;
  companyName: string;
  /** The single date this row sorts/filters by — submitted_at / created_at / requested_at, whichever is this row's own real anchor moment. */
  date: string | null;
  /** Raw DB status value — kept for the existing Status filter's own value/dedup logic, unchanged. */
  status: string;
  /**
   * Human-readable, payment-aware label (confirmed 2026-09-07, unified
   * payment/status flow follow-up) — `status` alone is ambiguous for the
   * `awaiting_payment` value (covers both "nothing checked yet" and
   * "reviewer confirmed unpaid"), same split already built for `/queue`.
   * Everything else falls back to a plain humanized version of `status`.
   */
  displayStatus: string;
  /** Raw payment_status, where this entity type has one (modules, Execution Sprint, and the new pre-payment re-audit rows) — null for sessions and for already-existing reports (a report only ever exists post-payment, so payment_status has nothing left to say by the time it's a `reports` row). */
  paymentStatus: string | null;
  /** 'Canceled' status (confirmed 2026-09-07) — the real reason, wherever one was recorded; null otherwise. */
  cancellationReason: string | null;
  severity: Severity | null;
  link: string;
}

/**
 * ONE label, both audiences (confirmed 2026-09-08, final status-flow
 * spec, superseding the 2026-09-07 "Not yet checked"/"Unpaid" split
 * documented in this function's own prior history) - the whole
 * "awaiting_payment" state is now genuinely one thing, shown identically
 * whether or not a reviewer has ever clicked "Mark as awaiting payment"
 * (the renamed former "Mark as unpaid" action - see module-payment-gate.ts/
 * execution-sprint/payment-gate.ts/reaudit-payment.ts's own docblocks).
 * The underlying `payment_status` enum still genuinely distinguishes
 * pending/processing/unpaid at the DB level (that mechanism was
 * explicitly NOT removed, only its display collapsed to one word) -
 * `paymentStatus` stays a real parameter here so every existing call site
 * keeps compiling unchanged, but it's deliberately unused inside this
 * function now; nothing about display depends on it anymore.
 *
 * Reading applied, flagged explicitly per the founder's own request to
 * surface ambiguity rather than guess silently: this collapses the
 * REVIEWER-facing label too, not just the client-facing one - "every
 * instance of 'Unpaid' becomes 'Awaiting Payment'" read as one universal
 * word for both audiences, not a second distinct admin-only word.
 *
 * `pending_review` still gets its own "Under review" treatment; every
 * other status falls back to the existing generic humanizer.
 */
export const AWAITING_PAYMENT_LABEL = "Awaiting Payment";

export function computeDisplayStatus(rawStatus: string, _paymentStatus: string | null): string {
  if (rawStatus === "awaiting_payment") return AWAITING_PAYMENT_LABEL;
  if (rawStatus === "pending_review") return "Under review";
  return humanizeStatus(rawStatus);
}

const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

const MODULE_LABELS: Record<string, string> = {
  ai_reliability: "AI Reliability Audit",
  tender_readiness: "Tender Readiness",
  data_protection: "Data Protection Compliance",
};

interface FindingLike {
  ai_draft: { severity?: Severity } | null;
  reviewer_edited_content: { severity?: Severity } | null;
  reviewer_status: string;
}

function highestSeverity(findings: FindingLike[]): Severity | null {
  let best: Severity | null = null;
  for (const f of findings) {
    if (f.reviewer_status === "rejected") continue;
    const content = f.reviewer_edited_content ?? f.ai_draft;
    const severity = content?.severity;
    if (!severity) continue;
    if (!best || SEVERITY_RANK[severity] > SEVERITY_RANK[best]) best = severity;
  }
  return best;
}

function companyNameOf(row: { companies: unknown }): string {
  return (row.companies as { name: string } | null)?.name ?? "Unknown company";
}

export async function loadUnifiedRequests(): Promise<UnifiedRequestRow[]> {
  const admin = createAdminClient();

  const [{ data: reports }, { data: moduleRequests }, { data: sessionRequests }, { data: sprints }, { data: pendingReaudits }] = await Promise.all([
    admin.from("reports").select("id, company_id, status, submitted_at, companies(name)").order("submitted_at", { ascending: false }),
    admin.from("module_requests").select("id, company_id, module_type, status, payment_status, cancellation_reason, created_at, companies(name)").order("created_at", { ascending: false }),
    admin
      .from("session_requests")
      .select("id, company_id, session_type, status, requested_at, companies(name)")
      .order("requested_at", { ascending: false }),
    admin
      .from("execution_sprints")
      .select("id, company_id, status, payment_status, cancellation_reason, start_date, report_id, companies(name)")
      .order("start_date", { ascending: false }),
    // Real, new row source (confirmed 2026-09-07) — a re-audit's own
    // pre-payment lifecycle (Submitted/Awaiting payment/Unpaid/Canceled)
    // lives entirely on pending_evidence_submissions and never shows up
    // as a `reports` row until payment actually clears — this list
    // previously had no way to represent that stage at all.
    //
    // Two real exclusions, not one: (a) `payment_status = 'not_required'`
    // — a company's genuinely first, free audit never goes through this
    // gate at all, so it's not a "request" in the sense this page tracks;
    // (b) `status = 'completed'` — once payment clears and the real audit
    // has actually run, a genuine `reports` row now exists and is already
    // its own row above; showing the same cycle again here would be a
    // real, confusing duplicate of the same underlying request, not a
    // second one.
    admin
      .from("pending_evidence_submissions")
      .select("id, company_id, status, payment_status, cancellation_reason, submitted_at, edit_window_closes_at, companies(name)")
      .neq("payment_status", "not_required")
      .neq("status", "completed")
      .order("submitted_at", { ascending: false }),
  ]);

  const reportIds = (reports ?? []).map((r) => r.id as string);
  const moduleIds = (moduleRequests ?? []).map((m) => m.id as string);

  const [{ data: allLensFindings }, { data: allModuleFindings }] = await Promise.all([
    reportIds.length > 0
      ? admin.from("lens_findings").select("report_id, ai_draft, reviewer_edited_content, reviewer_status").in("report_id", reportIds)
      : Promise.resolve({ data: [] as { report_id: string; ai_draft: unknown; reviewer_edited_content: unknown; reviewer_status: string }[] }),
    moduleIds.length > 0
      ? admin.from("module_findings").select("request_id, ai_draft, reviewer_edited_content, reviewer_status").in("request_id", moduleIds)
      : Promise.resolve({ data: [] as { request_id: string; ai_draft: unknown; reviewer_edited_content: unknown; reviewer_status: string }[] }),
  ]);

  const findingsByReport = new Map<string, FindingLike[]>();
  for (const f of allLensFindings ?? []) {
    const list = findingsByReport.get(f.report_id as string) ?? [];
    list.push(f as unknown as FindingLike);
    findingsByReport.set(f.report_id as string, list);
  }

  const findingsByModule = new Map<string, FindingLike[]>();
  for (const f of allModuleFindings ?? []) {
    const list = findingsByModule.get(f.request_id as string) ?? [];
    list.push(f as unknown as FindingLike);
    findingsByModule.set(f.request_id as string, list);
  }

  const rows: UnifiedRequestRow[] = [];

  for (const r of reports ?? []) {
    const status = r.status as string;
    rows.push({
      id: r.id as string,
      type: "audit",
      typeLabel: "Core Audit",
      badgeType: "core_audit",
      companyId: r.company_id as string,
      companyName: companyNameOf(r),
      date: r.submitted_at as string | null,
      status,
      displayStatus: computeDisplayStatus(status, null),
      paymentStatus: null,
      cancellationReason: null,
      severity: highestSeverity(findingsByReport.get(r.id as string) ?? []),
      link: `/review/${r.id}`,
    });
  }

  for (const m of moduleRequests ?? []) {
    const status = m.status as string;
    const paymentStatus = m.payment_status as string | null;
    rows.push({
      id: m.id as string,
      type: "module",
      typeLabel: MODULE_LABELS[m.module_type as string] ?? (m.module_type as string),
      badgeType: moduleTypeToItemType(m.module_type as string),
      companyId: m.company_id as string,
      companyName: companyNameOf(m),
      date: m.created_at as string | null,
      status,
      displayStatus: computeDisplayStatus(status, paymentStatus),
      paymentStatus,
      cancellationReason: (m.cancellation_reason as string | null) ?? null,
      severity: highestSeverity(findingsByModule.get(m.id as string) ?? []),
      link: `/review-module/${m.id}`,
    });
  }

  for (const s of sessionRequests ?? []) {
    const status = s.status as string;
    rows.push({
      id: s.id as string,
      type: "session",
      typeLabel: TYPE_LABELS[sessionTypeToItemType(s.session_type as string)],
      badgeType: sessionTypeToItemType(s.session_type as string),
      companyId: s.company_id as string,
      companyName: companyNameOf(s),
      date: s.requested_at as string | null,
      status,
      displayStatus: computeDisplayStatus(status, null),
      paymentStatus: null,
      // session_requests' own decline reason is reviewer_notes, not
      // selected here — a real, deliberate scope narrowing: this list
      // already links session rows straight to /company/[companyId],
      // where the full reviewer_notes field is already shown alongside
      // every other session detail, rather than duplicating that one
      // field's plumbing into this generic list too.
      cancellationReason: null,
      severity: null,
      link: `/company/${s.company_id}`,
    });
  }

  for (const sp of sprints ?? []) {
    const status = sp.status as string;
    const paymentStatus = sp.payment_status as string | null;
    rows.push({
      id: sp.id as string,
      type: "sprint",
      typeLabel: "Execution Sprint",
      badgeType: "execution_sprint",
      companyId: sp.company_id as string,
      companyName: companyNameOf(sp),
      date: sp.start_date as string | null,
      status,
      displayStatus: computeDisplayStatus(status, paymentStatus),
      paymentStatus,
      cancellationReason: (sp.cancellation_reason as string | null) ?? null,
      severity: null,
      link: `/review-sprint/${sp.id}`,
    });
  }

  // Real, new row type (confirmed 2026-09-07) — a re-audit's own
  // pre-payment lifecycle, previously invisible on this page entirely
  // (see the query's own docblock above). No dedicated reviewer
  // workspace exists for a request at this stage — links to
  // /company/[companyId], same as session requests already do.
  //
  // The raw `status` column here (editing/audit_in_progress/completed/
  // canceled) is NOT the same value the other row types use for
  // filtering — 'awaiting_payment' is a genuinely DERIVED stage for
  // pending_evidence_submissions (computeSubmissionDisplayStage(), same
  // function every other consumer of this table already uses), not a
  // literal DB column value the way it is for module_requests/
  // execution_sprints. Using the derived stage here instead of the raw
  // column keeps this row's `status`/`displayStatus` genuinely
  // comparable to the other row types' own real 'awaiting_payment' rows.
  for (const p of pendingReaudits ?? []) {
    const paymentStatus = p.payment_status as string | null;
    const stage =
      computeSubmissionDisplayStage({
        status: p.status as "editing" | "audit_in_progress" | "completed" | "canceled",
        edit_window_closes_at: p.edit_window_closes_at as string,
        payment_status: paymentStatus as "not_required" | "pending" | "paid" | "unpaid" | undefined,
      }) ?? (p.status as string);
    rows.push({
      id: p.id as string,
      type: "reaudit_pending",
      typeLabel: "Re-audit",
      badgeType: "core_audit",
      companyId: p.company_id as string,
      companyName: companyNameOf(p),
      date: p.submitted_at as string | null,
      status: stage,
      displayStatus: computeDisplayStatus(stage, paymentStatus),
      paymentStatus,
      cancellationReason: (p.cancellation_reason as string | null) ?? null,
      severity: null,
      link: `/company/${p.company_id}`,
    });
  }

  rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return rows;
}
