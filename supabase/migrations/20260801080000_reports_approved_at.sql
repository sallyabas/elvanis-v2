-- Time-per-audit instrumentation (spec Reviewer Workspace checklist,
-- confirmed 2026-08-01) — nothing recorded when a report actually finished
-- review, so there was no way to measure real reviewer turnaround for
-- scaling proof. approved_at is set once, in approveReport(), the moment
-- status flips pending_review -> approved; never touched afterward.
--
-- Combined with existing columns this gives two distinct durations:
--   full cycle:    submitted_at            -> approved_at (vs. the 72h SLA)
--   reviewer-only: edit_window_closes_at   -> approved_at (the part that
--                  actually scales with reviewer headcount, since the 24h
--                  client edit window isn't reviewer time)

alter table reports
  add column approved_at timestamptz;

comment on column reports.approved_at is
  'Set once, the instant approveReport() succeeds (pending_review -> approved). Paired with submitted_at/edit_window_closes_at for time-per-audit instrumentation.';
