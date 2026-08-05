-- Supports the Reviewer Workspace + Reviewer Queue (confirmed 2026-08-01).
--
-- 1. lens_findings needs somewhere to store what the reviewer changes a
--    finding to — ai_draft must stay immutable (the original AI output,
--    audit trail), and the client sees reviewer_edited_content when it's
--    set. This was missing from the original schema.
--
-- 2. reports needs to track the 24h edit window / 48h review period
--    (spec §2.3a) so the Reviewer Queue can filter to only what's actually
--    ready for review (edit window closed), and so the "notify the
--    reviewer the instant the edit window closes" check is idempotent
--    (reviewer_notified_at prevents re-notifying on every check run).
--    status stays the existing 4-value enum (draft/pending_review/approved/
--    sent) — no need to split it further; "still in edit window" vs.
--    "ready for review" is just edit_window_closes_at vs. now().

alter table lens_findings
  add column reviewer_edited_content jsonb;

comment on column lens_findings.reviewer_edited_content is
  'Set when reviewer_status = edited. The client sees this in place of ai_draft when present; ai_draft itself is never mutated.';

alter table reports
  add column submitted_at timestamptz,
  add column edit_window_closes_at timestamptz,
  add column reviewer_notified_at timestamptz;

comment on column reports.submitted_at is
  'When the client clicked "Submit for Review" — this is when the clock starts (spec §2.3a). Null while still gathering evidence.';
comment on column reports.edit_window_closes_at is
  'submitted_at + 24h. Reviewer Queue only shows reports where this has passed — still-editable reports are not yet the reviewer''s job.';
comment on column reports.reviewer_notified_at is
  'Set the instant edit_window_closes_at passes and the reviewer notification fires. Makes the notification check idempotent.';
