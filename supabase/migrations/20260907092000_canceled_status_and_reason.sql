-- 'Canceled' status, everywhere a request/booking status is tracked
-- (confirmed 2026-09-07, direct founder spec) — the real case where a
-- reviewer has followed up about unpaid status and either side decides
-- to give up rather than leave the request open indefinitely. Applies to
-- re-audits, the three modules, Execution Sprint, and Contact Sales
-- (Concierge/Training & Advisory) — but NOT as a duplicate concept where
-- one already exists: session_requests' own 'declined' value already
-- means exactly this for Concierge/Training & Advisory (confirmed
-- decision: one status, not two), so nothing changes on that table here.
-- service_status_records already has 'canceled' in its own enum
-- (service_status_value, migration 20260905140500) — nothing to add
-- there either.

-- Modules + core-audit reports share report_status (module_requests.status
-- reuses it) — 'canceled' becomes a legal value on both, though nothing
-- in this pass gives the free core-audit path a way to set it.
alter type report_status add value 'canceled';
alter table module_requests add column cancellation_reason text;

-- Execution Sprint gets its own value on its own enum, same reasoning.
alter type sprint_status add value 'canceled';
alter table execution_sprints add column cancellation_reason text;

-- Re-audits: the pre-payment gate lives on pending_evidence_submissions,
-- a genuinely different enum (pending_evidence_submission_status) from
-- the two above. The partial unique index enforcing "at most one ACTIVE
-- submission per company" must treat 'canceled' the same as 'completed'
-- — a canceled re-audit request must free the slot for a new one, not
-- permanently block it.
alter type pending_evidence_submission_status add value 'canceled';
alter table pending_evidence_submissions add column cancellation_reason text;

-- The partial-unique-index rebuild that actually USES 'canceled' lives in
-- its own, later migration (20260907092500) — Postgres refuses to use a
-- freshly-added enum value in the same transaction that added it
-- (confirmed live: "unsafe use of new value... of enum type", SQLSTATE
-- 55P04), so it can't be the very next statement in this same file.
