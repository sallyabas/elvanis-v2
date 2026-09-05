-- Real gap found while wiring the re-audit-awaiting-payment reviewer
-- notification (confirmed 2026-09-06) — same "own related_*_id column so
-- dispatch.ts can look up real content" pattern as related_contact_request_id.
alter table notifications add column related_pending_submission_id uuid references pending_evidence_submissions(id) on delete set null;
