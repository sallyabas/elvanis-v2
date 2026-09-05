-- Re-audit payment gate (confirmed 2026-09-06, direct founder decision) —
-- closes a real, confirmed gap: nothing in this app ever checked whether a
-- client's re-audit (a company's 2nd+ real Core Audit cycle) had been paid
-- before running it. "Submit new evidence" created a brand-new, fully free
-- audit cycle regardless of prior audit history — the only signal was
-- client-facing copy ("this is a paid re-audit"), never enforced.
--
-- payment_status is set ONCE, at row-creation time (see
-- upsertPendingEvidenceSubmission()): 'not_required' for a company's
-- genuinely first/free audit, 'pending' for every subsequent one. Never
-- reset or recomputed afterward — eligibility is decided once, at
-- submission time, same "compute now, don't recompute later" principle
-- already used for edit_window_closes_at/review_due_at.
--
-- Deliberately NOT a new value on pending_evidence_submission_status
-- itself — "awaiting payment" is a genuinely DERIVED display state (the
-- edit window has closed, but payment_status is still 'pending'), same
-- "compute in code, don't store what could drift" treatment already given
-- to "queued_for_audit" (see submission-status.ts). The raw status column
-- stays 'editing' the whole time a row is genuinely waiting on payment —
-- it only ever advances to 'audit_in_progress' once payment clears, via
-- the exact same atomic conditional-UPDATE discipline every other claimer
-- of this table already uses (the cron tick, the client's own "Submit
-- now" fast-track, and now a third: the reviewer's "Mark as paid" action).
create type reaudit_payment_status as enum ('not_required', 'pending', 'paid');

alter table pending_evidence_submissions
  add column payment_status reaudit_payment_status not null default 'not_required';

-- Idempotency guard for the one-time admin notification (see
-- run-pending-audits.ts) — same pattern as reports.reviewer_notified_at: a
-- row sitting at status='editing'/payment_status='pending' past its window
-- would otherwise be re-selected by every single cron tick forever, and
-- without this guard would re-notify the admin every ~20 minutes for as
-- long as it sits unpaid.
alter table pending_evidence_submissions
  add column payment_notified_at timestamptz;
