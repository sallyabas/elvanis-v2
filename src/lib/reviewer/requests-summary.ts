import { createAdminClient } from "@/lib/supabase/admin";
import { getSettingNumber } from "@/lib/app-settings";
import { loadServiceStatusRecords } from "@/lib/reviewer/service-status";

/**
 * Reviewer Home page — Requests widget (confirmed 2026-09-08, final
 * status-flow spec, item 7). A real, detailed breakdown, not one summary
 * number: per-bucket counts, cross-tabbed against 8 real service types.
 * Deliberately its own module, not layered on top of unified-requests.ts
 * (RequestsFilterClient.tsx's own backing list) — that page's row shape
 * is built for filtering/display, not for this widget's genuinely
 * different need (overdue-turnaround settings, rerun_of_report_id to
 * split Core Audit from re-audits, and a 7-bucket-per-row computation
 * instead of one display string). The pure bucket logic
 * (computeRequestBuckets) is separated from the DB-loading function
 * specifically so it can be unit-tested without touching the database —
 * same "own small test suite" discipline as computeDisplayStatus()/
 * computeJourneyStatus(), see requests-summary.test-cases.ts.
 *
 * Confirmed design decisions, all disclosed, not silently assumed:
 * - "Unpaid" is NOT a separate bucket here — item 1 of this same spec
 *   collapsed "Unpaid" into "Awaiting Payment" as one status shown
 *   identically everywhere else in the app; giving this widget its own
 *   surviving "Unpaid" bucket would directly contradict that rename.
 *   `awaiting_payment` covers what used to be pending/processing/unpaid
 *   payment_status values alike.
 * - Buckets are NOT mutually exclusive — a row can be BOTH 'paid' and
 *   'under_review' (or 'paid' and 'overdue') at once. 'paid' is a real
 *   rollup/business metric ("how many of these have ever involved a
 *   successful payment"), confirmed correct to overlap with
 *   under_review/completed, not a bug to fix.
 * - 'overdue' only ever applies to Core Audit/re-audits (reports.
 *   review_due_at) and the 3 modules (created_at + the existing
 *   module_delivery_turnaround_target_hours setting, same computation
 *   /queue already uses) — Execution Sprint and Contact Sales have no
 *   deadline concept anywhere in this schema, so they correctly always
 *   show 0 here, not an invented one.
 * - 'refunded' only ever applies to Concierge/Training & Advisory (no
 *   refund concept exists for AI-driven services at all, confirmed
 *   design) — the other 6 service types correctly always show 0.
 * - Contact Sales has no separate 'paid' payment_status column — its own
 *   status value IS the payment signal ('booked'/'completed'/'refunded'
 *   all imply payment was received, matching "Booked (the moment payment
 *   is confirmed)"), so 'paid' is derived from status directly for these
 *   two, not from a payment_status field that doesn't exist for them.
 */

export type RequestServiceType =
  | "core_audit"
  | "reaudit"
  | "tender_readiness"
  | "ai_reliability"
  | "data_protection"
  | "execution_sprint"
  | "concierge"
  | "training_advisory";

export const REQUEST_SERVICE_TYPE_LABELS: Record<RequestServiceType, string> = {
  core_audit: "Core Audit",
  reaudit: "Re-audits",
  tender_readiness: "Tender Readiness",
  ai_reliability: "AI Reliability Audit",
  data_protection: "Data Protection Compliance",
  execution_sprint: "Execution Sprint",
  concierge: "Concierge",
  training_advisory: "Training & Advisory",
};

export type RequestBucket = "canceled" | "refunded" | "overdue" | "paid" | "awaiting_payment" | "under_review" | "completed";

export const REQUEST_BUCKET_LABELS: Record<RequestBucket, string> = {
  canceled: "Canceled",
  refunded: "Refunded",
  overdue: "Overdue",
  paid: "Paid",
  awaiting_payment: "Awaiting Payment",
  under_review: "Under Review",
  completed: "Completed",
};

export const REQUEST_BUCKET_ORDER: RequestBucket[] = ["awaiting_payment", "paid", "under_review", "completed", "overdue", "canceled", "refunded"];

/**
 * One row's real, current buckets — a real Set, not a single value, since
 * 'paid' genuinely coexists with 'under_review'/'completed', and
 * 'overdue' genuinely coexists with 'awaiting_payment'/'under_review'.
 */
export interface RequestBucketInput {
  serviceType: RequestServiceType;
  /** Raw status, genuinely different vocabulary per service type — report_status / sprint_status / service_status_value / pending_evidence_submissions' own editing/queued_for_audit/audit_in_progress/awaiting_payment/canceled/completed stage. */
  status: string;
  /** module_payment_status / sprint_payment_status / reaudit_payment_status — null for reports that were never gated (a free first Core Audit) and for Contact Sales (its own status value IS the payment signal, see this file's own docblock). */
  paymentStatus?: "pending" | "processing" | "paid" | "unpaid" | "not_required" | null;
  /** reports.review_due_at — Core Audit/re-audits only. */
  reviewDueAt?: string | null;
  /** created_at, for the module overdue-turnaround computation — modules only. */
  createdAt?: string | null;
  /** app_settings.module_delivery_turnaround_target_hours — modules only, passed in since it's a real DB setting, not a constant. */
  moduleTurnaroundHours?: number;
  /** "now", injected for deterministic unit testing rather than read internally. */
  now: Date;
}

export function computeRequestBuckets(input: RequestBucketInput): Set<RequestBucket> {
  const buckets = new Set<RequestBucket>();
  const isContactSales = input.serviceType === "concierge" || input.serviceType === "training_advisory";
  const isModule = input.serviceType === "tender_readiness" || input.serviceType === "ai_reliability" || input.serviceType === "data_protection";
  const isAudit = input.serviceType === "core_audit" || input.serviceType === "reaudit";

  if (isContactSales) {
    // service_status_value: requested/booked/completed/refunded/canceled
    // — its own status IS the payment signal (see this file's docblock).
    if (input.status === "canceled") {
      buckets.add("canceled");
      return buckets;
    }
    if (input.status === "refunded") {
      buckets.add("refunded");
      buckets.add("paid"); // it was genuinely paid before being refunded.
      return buckets;
    }
    if (input.status === "booked" || input.status === "completed") {
      buckets.add("paid");
      buckets.add(input.status === "completed" ? "completed" : "under_review");
    }
    // 'requested' — nothing checked/confirmed yet; no bucket beyond the
    // implicit "not yet reached any of the above" (matching the same
    // "one status until something real happens" principle as item 1).
    return buckets;
  }

  // AI-driven services (Core Audit/re-audits + 3 modules + Execution
  // Sprint) — a real payment_status column, or (for a genuinely free
  // first Core Audit) none at all.
  if (input.status === "canceled") {
    buckets.add("canceled");
    return buckets;
  }

  // 'core_audit' (a genuinely free first audit) is never "paid" — there
  // was no payment. 'reaudit' rows are always paid the moment a real
  // `reports` row exists at all (the entire payment-gate architecture
  // guarantees a re-audit's reports row can't exist until payment
  // cleared) — that's why a re-audit's own `paymentStatus` is never
  // passed at all (see loadRequestsSummary()'s reports loop below); it's
  // determined structurally, by serviceType, not by a field that isn't
  // available for a completed reports row anyway.
  const isPaid = input.serviceType === "reaudit" || input.paymentStatus === "paid";
  if (isPaid) buckets.add("paid");

  if (input.status === "awaiting_payment" || input.status === "proposed") {
    buckets.add("awaiting_payment");
  } else if (input.status === "sent" || input.status === "completed" || input.status === "complete") {
    // 'sent' (reports/modules), 'completed' (generic), 'complete'
    // (sprint_status's own real spelling, no trailing 'd' — confirmed by
    // reading the actual enum, not assumed; a real bug this test suite
    // caught live before this fix, not a hypothetical).
    buckets.add("completed");
  } else if (input.status !== "editing" && input.status !== "queued_for_audit" && input.status !== "draft") {
    // pending_review/approved/scoped/in_progress/audit_in_progress — the
    // real "paid and being worked on" window for every AI-driven type.
    buckets.add("under_review");
  }

  if (isAudit && input.reviewDueAt && new Date(input.reviewDueAt) < input.now) {
    buckets.add("overdue");
  }
  if (isModule && input.createdAt && input.moduleTurnaroundHours != null) {
    const deadline = new Date(new Date(input.createdAt).getTime() + input.moduleTurnaroundHours * 60 * 60 * 1000);
    if (deadline < input.now) buckets.add("overdue");
  }

  return buckets;
}

export interface RequestsSummary {
  byBucket: Record<RequestBucket, number>;
  byServiceType: Record<RequestServiceType, Record<RequestBucket, number>>;
}

function emptyBucketRecord(): Record<RequestBucket, number> {
  return { canceled: 0, refunded: 0, overdue: 0, paid: 0, awaiting_payment: 0, under_review: 0, completed: 0 };
}

/** Real DB load + aggregation — the pure computeRequestBuckets() above does the actual per-row logic, unit-tested independently of this. */
export async function loadRequestsSummary(): Promise<RequestsSummary> {
  const admin = createAdminClient();
  const now = new Date();
  const moduleTurnaroundHours = await getSettingNumber("module_delivery_turnaround_target_hours", 48);

  const [{ data: reports }, { data: moduleRequests }, { data: sprints }, { data: sessions }] = await Promise.all([
    admin.from("reports").select("status, review_due_at, rerun_of_report_id"),
    admin.from("module_requests").select("status, payment_status, module_type, created_at"),
    admin.from("execution_sprints").select("status, payment_status"),
    admin.from("session_requests").select("id, session_type").in("session_type", ["concierge_inquiry", "training_advisory"]),
  ]);
  // service_status_records is polymorphic (entity_type/entity_id, no real
  // FK Supabase could embed-join on) — a real, separate query, same
  // pattern loadServiceStatusRecords() itself already exists for (reused
  // directly, not reinvented).
  const contactSalesStatus = await loadServiceStatusRecords(
    "session_request",
    (sessions ?? []).map((s) => s.id as string),
  );

  const byBucket = emptyBucketRecord();
  const byServiceType: RequestsSummary["byServiceType"] = {
    core_audit: emptyBucketRecord(),
    reaudit: emptyBucketRecord(),
    tender_readiness: emptyBucketRecord(),
    ai_reliability: emptyBucketRecord(),
    data_protection: emptyBucketRecord(),
    execution_sprint: emptyBucketRecord(),
    concierge: emptyBucketRecord(),
    training_advisory: emptyBucketRecord(),
  };

  function apply(serviceType: RequestServiceType, buckets: Set<RequestBucket>) {
    for (const b of buckets) {
      byBucket[b] += 1;
      byServiceType[serviceType][b] += 1;
    }
  }

  for (const r of reports ?? []) {
    const serviceType: RequestServiceType = r.rerun_of_report_id !== null ? "reaudit" : "core_audit";
    apply(
      serviceType,
      computeRequestBuckets({ serviceType, status: r.status as string, paymentStatus: null, reviewDueAt: r.review_due_at as string | null, now }),
    );
  }

  const MODULE_TYPE_TO_SERVICE: Record<string, RequestServiceType> = {
    tender_readiness: "tender_readiness",
    ai_reliability: "ai_reliability",
    data_protection: "data_protection",
  };
  for (const m of moduleRequests ?? []) {
    const serviceType = MODULE_TYPE_TO_SERVICE[m.module_type as string];
    if (!serviceType) continue;
    apply(
      serviceType,
      computeRequestBuckets({
        serviceType,
        status: m.status as string,
        paymentStatus: m.payment_status as RequestBucketInput["paymentStatus"],
        createdAt: m.created_at as string | null,
        moduleTurnaroundHours,
        now,
      }),
    );
  }

  for (const s of sprints ?? []) {
    apply(
      "execution_sprint",
      computeRequestBuckets({ serviceType: "execution_sprint", status: s.status as string, paymentStatus: s.payment_status as RequestBucketInput["paymentStatus"], now }),
    );
  }

  for (const s of sessions ?? []) {
    const serviceType: RequestServiceType = s.session_type === "concierge_inquiry" ? "concierge" : "training_advisory";
    const status = contactSalesStatus.get(s.id as string)?.status ?? "requested";
    apply(serviceType, computeRequestBuckets({ serviceType, status, now }));
  }

  return { byBucket, byServiceType };
}
