/**
 * Committed, runnable test suite for computeRequestBuckets() (confirmed
 * 2026-09-08, final status-flow spec, item 7) — same "own small test
 * suite" discipline as computeDisplayStatus()/computeJourneyStatus(),
 * same pattern as jurisdiction.test-cases.ts/path-b-routing.test-cases.ts.
 * Pure function, no DB — run via:
 *   npx tsx --env-file=.env.local src/lib/reviewer/requests-summary.test-cases.ts
 */
import { computeRequestBuckets, type RequestBucket, type RequestBucketInput } from "./requests-summary";

interface Case {
  name: string;
  input: Omit<RequestBucketInput, "now"> & { now?: Date };
  expectBuckets: RequestBucket[];
}

const NOW = new Date("2026-09-08T12:00:00.000Z");

const cases: Case[] = [
  // --- AI-driven services: Canceled, only reachable pre-payment ---
  {
    name: "module canceled -> only 'canceled', paid never applies",
    input: { serviceType: "tender_readiness", status: "canceled", paymentStatus: null },
    expectBuckets: ["canceled"],
  },
  {
    name: "sprint canceled -> only 'canceled'",
    input: { serviceType: "execution_sprint", status: "canceled", paymentStatus: null },
    expectBuckets: ["canceled"],
  },

  // --- AI-driven services: Awaiting Payment (item 1's collapse applies here too — no separate 'unpaid' bucket) ---
  {
    name: "module awaiting_payment, paymentStatus pending -> 'awaiting_payment' only, not 'paid'",
    input: { serviceType: "tender_readiness", status: "awaiting_payment", paymentStatus: "pending" },
    expectBuckets: ["awaiting_payment"],
  },
  {
    name: "module awaiting_payment, paymentStatus unpaid -> STILL just 'awaiting_payment', not a separate bucket (item 1's collapse)",
    input: { serviceType: "ai_reliability", status: "awaiting_payment", paymentStatus: "unpaid" },
    expectBuckets: ["awaiting_payment"],
  },
  {
    name: "sprint proposed (pre-payment, reviewer hasn't proposed a payable state yet) -> 'awaiting_payment'",
    input: { serviceType: "execution_sprint", status: "proposed", paymentStatus: null },
    expectBuckets: ["awaiting_payment"],
  },

  // --- AI-driven services: Paid is a rollup, genuinely overlapping with Under Review / Completed ---
  {
    name: "module paid + pending_review -> BOTH 'paid' and 'under_review' (confirmed correct overlap, not a bug)",
    input: { serviceType: "data_protection", status: "pending_review", paymentStatus: "paid" },
    expectBuckets: ["paid", "under_review"],
  },
  {
    name: "module paid + sent -> BOTH 'paid' and 'completed'",
    input: { serviceType: "tender_readiness", status: "sent", paymentStatus: "paid" },
    expectBuckets: ["paid", "completed"],
  },
  {
    name: "sprint paid + scoped -> 'paid' and 'under_review'",
    input: { serviceType: "execution_sprint", status: "scoped", paymentStatus: "paid" },
    expectBuckets: ["paid", "under_review"],
  },
  {
    name: "sprint paid + in_progress -> 'paid' and 'under_review'",
    input: { serviceType: "execution_sprint", status: "in_progress", paymentStatus: "paid" },
    expectBuckets: ["paid", "under_review"],
  },
  {
    name: "sprint paid + complete -> 'paid' and 'completed'",
    input: { serviceType: "execution_sprint", status: "complete", paymentStatus: "paid" },
    expectBuckets: ["paid", "completed"],
  },

  // --- Core Audit (genuinely free) vs re-audit (always paid) — the real, deliberate structural distinction ---
  {
    name: "core_audit (free, no paymentStatus field at all) sent -> 'completed' ONLY, never 'paid' — it was never paid",
    input: { serviceType: "core_audit", status: "sent" },
    expectBuckets: ["completed"],
  },
  {
    name: "core_audit pending_review -> 'under_review' only, still never 'paid'",
    input: { serviceType: "core_audit", status: "pending_review" },
    expectBuckets: ["under_review"],
  },
  {
    name: "reaudit sent -> 'paid' AND 'completed' — a reports row existing at all proves payment cleared",
    input: { serviceType: "reaudit", status: "sent" },
    expectBuckets: ["paid", "completed"],
  },
  {
    name: "reaudit pending_review -> 'paid' AND 'under_review'",
    input: { serviceType: "reaudit", status: "pending_review" },
    expectBuckets: ["paid", "under_review"],
  },

  // --- Overdue: only Core Audit/re-audits (review_due_at) and modules (turnaround setting) — never sprints/Contact Sales ---
  {
    name: "core_audit pending_review, review_due_at in the past -> 'under_review' + 'overdue'",
    input: { serviceType: "core_audit", status: "pending_review", reviewDueAt: "2026-09-01T00:00:00.000Z" },
    expectBuckets: ["under_review", "overdue"],
  },
  {
    name: "core_audit pending_review, review_due_at still in the future -> 'under_review' only, no 'overdue'",
    input: { serviceType: "core_audit", status: "pending_review", reviewDueAt: "2026-09-20T00:00:00.000Z" },
    expectBuckets: ["under_review"],
  },
  {
    name: "module awaiting_payment, created 3 days ago, 48h turnaround -> 'awaiting_payment' + 'overdue'",
    input: { serviceType: "ai_reliability", status: "awaiting_payment", paymentStatus: "pending", createdAt: "2026-09-05T00:00:00.000Z", moduleTurnaroundHours: 48 },
    expectBuckets: ["awaiting_payment", "overdue"],
  },
  {
    name: "module awaiting_payment, created 1 hour ago, 48h turnaround -> 'awaiting_payment' only, not overdue yet",
    input: { serviceType: "ai_reliability", status: "awaiting_payment", paymentStatus: "pending", createdAt: "2026-09-08T11:00:00.000Z", moduleTurnaroundHours: 48 },
    expectBuckets: ["awaiting_payment"],
  },
  {
    name: "sprint, even with a hypothetical stale-looking state, never gets 'overdue' — no deadline concept exists for this type",
    input: { serviceType: "execution_sprint", status: "in_progress", paymentStatus: "paid" },
    expectBuckets: ["paid", "under_review"],
  },

  // --- Contact Sales (Concierge/Training & Advisory): own real flow, no separate payment_status column ---
  {
    name: "concierge requested -> no buckets yet (nothing confirmed)",
    input: { serviceType: "concierge", status: "requested" },
    expectBuckets: [],
  },
  {
    name: "concierge booked -> 'paid' (booking IS the payment confirmation) + 'under_review'",
    input: { serviceType: "concierge", status: "booked" },
    expectBuckets: ["paid", "under_review"],
  },
  {
    name: "concierge completed -> 'paid' + 'completed'",
    input: { serviceType: "concierge", status: "completed" },
    expectBuckets: ["paid", "completed"],
  },
  {
    name: "training_advisory refunded -> 'refunded' + 'paid' (it genuinely was paid before being refunded), never 'completed'/'under_review'",
    input: { serviceType: "training_advisory", status: "refunded" },
    expectBuckets: ["refunded", "paid"],
  },
  {
    name: "concierge canceled -> only 'canceled', no 'paid' (cancel only reachable pre-payment)",
    input: { serviceType: "concierge", status: "canceled" },
    expectBuckets: ["canceled"],
  },
  {
    name: "refunded/canceled never get 'overdue' — no deadline concept for Contact Sales at all",
    input: { serviceType: "training_advisory", status: "booked" },
    expectBuckets: ["paid", "under_review"],
  },
];

let failed = 0;
for (const c of cases) {
  const result = computeRequestBuckets({ ...c.input, now: c.input.now ?? NOW });
  const actual = [...result].sort();
  const expected = [...c.expectBuckets].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failed++;
    console.error(`FAIL: ${c.name}\n  expected [${expected.join(", ")}], got [${actual.join(", ")}]`);
  } else {
    console.log(`PASS: ${c.name}`);
  }
}

console.log(`\n${cases.length - failed}/${cases.length} passing`);
if (failed > 0) process.exit(1);
