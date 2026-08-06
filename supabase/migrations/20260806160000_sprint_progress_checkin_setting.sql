-- Execution Sprint progress check-in cadence (confirmed 2026-08-06) — same
-- app_settings pattern as re_audit_reminder_days/evidence_completeness_nudge_days.
-- 7 days of client inactivity on an in_progress sprint (max 28 days total)
-- triggers a check-in reminder, recurring until the client signs off.
insert into app_settings (key, value) values ('sprint_progress_checkin_days', '7');
