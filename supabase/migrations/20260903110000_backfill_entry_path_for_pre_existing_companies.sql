-- Real regression found and fixed live, same day as the gate itself
-- (confirmed 2026-09-03) — (app)/layout.tsx's new completeness gate
-- (redirect to /onboarding whenever entry_path is null or 'undecided')
-- was verified against a fresh test account, but never against a
-- pre-existing one. `entry_path` was added 2026-08-27 as a nullable
-- column with no backfill for rows that already existed — every company
-- created before that date (7 real, kept accounts confirmed by direct
-- query, including Nimbus Ledger Ltd and Riverbank Analytics Ltd) has
-- entry_path IS NULL, and the new gate treats null the same as
-- 'undecided' — locking every one of these genuinely complete,
-- already-delivered-report accounts out of their own sidebar/dashboard.
--
-- Every company that predates entry_path went through the single,
-- unified onboarding flow that existed before Path A/B routing was
-- introduced — that flow IS what's now called Path A ("Business
-- Diagnosis"), so 'diagnosis' is the correct, unambiguous backfill value
-- for all of them, not a guess. entry_path_set_at is backfilled to
-- created_at as the most honest available anchor, since the real
-- "path chosen" moment predates this column's own existence.
update companies
set entry_path = 'diagnosis', entry_path_set_at = created_at
where entry_path is null;
