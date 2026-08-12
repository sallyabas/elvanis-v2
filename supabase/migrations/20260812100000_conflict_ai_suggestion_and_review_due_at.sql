-- Two real gaps closed together, both surfaced during live reviewer
-- testing 2026-08-12 (confirmed direct founder request):
--
-- 1. The 48h review-SLA period has only ever been narrative — sla.ts's
--    own docblock already flagged this exact tradeoff: "migrating it to
--    app_settings now would let the copy promise a number nothing
--    actually holds to... only promote it alongside building real
--    enforcement for it." That's what this migration is — real
--    enforcement, not a side effect. reports.review_due_at is a real,
--    stamped deadline (edit_window_closes_at + review_period_hours,
--    computed once at report-creation time, same "stamp it, don't
--    recompute against a possibly-later app_settings value" principle
--    already used for edit_window_closes_at itself), and
--    app_settings.review_period_hours replaces the hardcoded
--    REVIEW_PERIOD_HOURS constant, same DB-backed pattern as
--    edit_window_hours.
--
-- 2. Conflict Detection never suggested a resolution, by original
--    design ("never resolves anything itself"). Direct founder request
--    reverses that: the AI now also drafts a suggested resolution per
--    conflict, which the reviewer accepts/edits before saving — same
--    "AI drafts, human decides" pattern as every other finding in this
--    app, just applied to conflicts for the first time.

alter table reports add column review_due_at timestamptz;

-- Backfill existing reports so this is never NULL for anything that
-- already has an edit_window_closes_at — informational for already-sent
-- reports, real for anything still pending_review.
update reports
set review_due_at = edit_window_closes_at + interval '48 hours'
where edit_window_closes_at is not null;

alter table finding_conflicts add column ai_suggested_resolution text;

insert into app_settings (key, value)
values ('review_period_hours', '48')
on conflict (key) do nothing;
