-- EDIT_WINDOW_HOURS migrated to app_settings (confirmed 2026-08-06) —
-- reconsidered from the hardcoded-values audit's original "leave hardcoded
-- for now" call. The earlier concern (client-facing SLA copy drifting out
-- of sync with the enforced value) is closed by construction, not just
-- avoided: the real confirmation modal built alongside this migration
-- (src/app/evidence-intake/EvidenceIntakeForm.tsx) reads this exact same
-- setting to build its copy, rather than a separately hardcoded string.
-- Same admin-adjustable pattern as re_audit_reminder_days/
-- evidence_completeness_nudge_days — reuses the existing app_settings
-- table and getSettingNumber() helper, no new table needed for a single
-- scalar value.
insert into app_settings (key, value) values
  ('edit_window_hours', '24');
