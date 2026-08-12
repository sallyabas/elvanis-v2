-- Real gap closed, confirmed 2026-08-12 (round-2 bug list, item #4: "the
-- client has no visible history of their own evidence intake — submission
-- date, edit date... are not retained/viewable anywhere on their side").
-- pending_evidence_submissions already anchors submitted_at once at first
-- submission (deliberately never reset — see the original migration's own
-- docblock, that's the SLA-integrity guarantee), but nothing tracked WHEN
-- a later in-window edit actually happened — every resubmit is a plain
-- UPDATE with no timestamp column to bump. Without this, the client-facing
-- UI has no honest way to show "last edited" separately from "first
-- submitted."
alter table pending_evidence_submissions
  add column updated_at timestamptz not null default now();

-- Backfill: for any row that predates this column, the best honest value
-- is submitted_at itself (no edit has been distinguishably recorded yet).
update pending_evidence_submissions set updated_at = submitted_at;
