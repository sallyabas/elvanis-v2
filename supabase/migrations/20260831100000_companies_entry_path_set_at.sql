-- Real fix (confirmed 2026-08-31, direct founder bug report on the
-- entry_path investigation above): hasCompletedPathBSetup() checked for
-- ANY module_requests row or compliance_consultation session_request EVER
-- created for the company, with no time-scoping to the current
-- entry_path='ai_audit' era. A company that switches away from 'ai_audit'
-- and later switches back would immediately register as "done" from old,
-- historical requests belonging to a PREVIOUS era, silently skipping the
-- triage-resume flow it should actually go through this time.
--
-- Fixed with a dedicated timestamp column tracking when entry_path was
-- last SET (not a generic "last touched" column — companies.updated_at is
-- never actually bumped by any writer in this codebase, confirmed by grep,
-- so it can't stand in for this). Every one of the 5 real write sites of
-- entry_path (createCompanyMinimal, createCompanyAndGoal,
-- addGoalToExistingCompany, chooseEntryPath, submitPathBMinimalProfile)
-- now also stamps this column in the same write.
--
-- Backfill: existing rows get entry_path_set_at = created_at as the best
-- available approximation (updated_at is provably identical to created_at
-- for every existing row, per the same "never bumped" fact above) — this
-- is a disclosed approximation for historical data, not a claim that the
-- real switch happened exactly then.
alter table companies add column entry_path_set_at timestamptz;

update companies set entry_path_set_at = created_at where entry_path is not null;

comment on column companies.entry_path_set_at is
  'When entry_path was last set (any of its 5 real write sites) — used to time-scope hasCompletedPathBSetup() so a client who switches entry_path away and back is not silently marked "done" from a prior era''s historical module/session requests. NOT a generic last-touched timestamp.';
