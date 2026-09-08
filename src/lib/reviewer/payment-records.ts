/**
 * PaymentEntityType — the one real survivor of this file (confirmed
 * 2026-09-08, final status-flow spec, item 4). The old `payment_records`
 * table this file used to read/write (a manual, reviewer-maintained N/A/
 * Unpaid/Invoiced/Paid dropdown, PaymentStatusRow on /company/[companyId])
 * was removed entirely — every real payable entity now has its own real,
 * automated payment-gate columns (module_requests.payment_status,
 * execution_sprints.payment_status, pending_evidence_submissions.
 * payment_status) or, for Contact Sales specifically, its own real
 * Requested/Booked/Completed/Refunded/Canceled flow (service_status.ts).
 *
 * This type is kept here, not deleted along with the rest, because
 * service-status.ts (a genuinely different, still-live system —
 * ContactSalesStatusRow's own backing table) already imports it from this
 * exact path, and the four entity kinds it enumerates (module requests,
 * Execution Sprints, session requests, reports) are shared, real concepts
 * across both systems, not something specific to the removed table.
 */
export type PaymentEntityType = "module_request" | "execution_sprint" | "session_request" | "report";
