-- Production cron scheduler support (confirmed 2026-08-02, second item in
-- the confirmed pre-launch order after reviewer auth). Three real gaps
-- closed here, not anticipated upfront:
--
-- 1. ai_opportunity_synthesis and readiness_scores were scoped only by
--    company_id, never report_id — same ambiguity bug lens_findings had
--    before its report_id fix (20260801071010): a company with more than
--    one report (re-audits are an explicit product feature) would have no
--    way to tell which synthesis run belongs to which report. Both tables
--    are still genuinely empty (synthesizeAiOpportunities() has never
--    persisted anything — it only returned a result object the caller
--    printed), so report_id can be added NOT NULL directly, no backfill.
--
-- 2. evidenceSufficiencyByLens and governanceMaturityTier — both required
--    by synthesizeAiOpportunities() for its readiness scoring — were only
--    ever produced in-memory during runAudit() and never persisted. Since
--    synthesis is designed to run AFTER reviewer approval (which can
--    happen hours or days later, in a separate process), nothing could
--    reconstruct these inputs from DB state alone. Found live 2026-08-02
--    doing the closed-out end-to-end audit test.
--
-- 3. reports.ai_opportunity_synthesized_at makes the cron's synthesis pass
--    idempotent, same pattern as reviewer_notified_at for the edit-window
--    notification check.

alter table ai_opportunity_synthesis
  add column report_id uuid not null references reports (id) on delete cascade;

alter table readiness_scores
  add column report_id uuid not null references reports (id) on delete cascade;

alter table reports
  add column evidence_sufficiency_by_lens jsonb,
  add column governance_maturity_tier text,
  add column ai_opportunity_synthesized_at timestamptz;

comment on column reports.evidence_sufficiency_by_lens is
  'Per-lens evidenceSufficiency verdicts from the original runAudit() call, persisted so AI Opportunity Synthesis can run later (post-approval) without recomputing.';
comment on column reports.governance_maturity_tier is
  'AI & Governance lens''s own computed overallMaturity.tier from the original runAudit() call — never re-derived at synthesis time.';
comment on column reports.ai_opportunity_synthesized_at is
  'Set once, the instant the cron''s AI Opportunity Synthesis pass succeeds for this report. Makes that pass idempotent.';

-- Simple admin-adjustable operational thresholds (confirmed 2026-08-02: the
-- re-audit reminder cadence must be adjustable without a redeploy). No
-- admin UI exists yet — edit via direct SQL until one does. Deliberately a
-- plain key/value table, not a settings framework — two rows today.
create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value) values
  ('re_audit_reminder_days', '90'),
  ('evidence_completeness_nudge_days', '7');

-- notification_event_type needs a value for re-audit reminders —
-- evidence_incomplete already exists and covers both the client-facing
-- nudge and the reviewer-facing visibility notification (differentiated by
-- recipient_type, not a second event type).
alter type notification_event_type add value 're_audit_reminder';
