-- Real "does not apply to us" per-finding feedback (confirmed 2026-08-16,
-- final Dashboard redesign pass) — a genuinely different signal from the
-- existing sprint_interest_requests table: that one is about ACTING on a
-- finding ("interested in help implementing this?"); this one is a
-- correctness signal — the client flagging that a finding is simply wrong
-- for their business, logged for future prompt refinement, same discipline
-- as every other feedback-logging mechanism in this build (case_library,
-- sprint_interest_requests, etc.).
--
-- finding_id deliberately has no FK constraint — a finding can be either a
-- core-audit lens_findings row or a standalone-module module_findings row,
-- and Postgres has no clean way to express "references one of these two
-- tables." finding_source distinguishes which; ownership is verified in
-- application code before every insert (see src/lib/reports/finding-feedback.ts),
-- since RLS alone can't validate a cross-table polymorphic reference either.
-- finding_title is a denormalized snapshot, not a live join — so this
-- feedback stays legible even if the underlying finding is later edited.

create type finding_feedback_source as enum ('lens_finding', 'module_finding');

create table finding_feedback (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  finding_source finding_feedback_source not null,
  finding_id uuid not null,
  finding_title text not null,
  created_at timestamptz not null default now()
);

create index on finding_feedback (company_id);
create index on finding_feedback (finding_source, finding_id);

alter table finding_feedback enable row level security;

-- Real inserts always go through the admin client after an explicit
-- server-side ownership check (same "session-scoped RLS is only ever
-- exercised for reads" precedent already established for module_requests/
-- module_findings/procurement_answers) — no insert policy for the client
-- role. A real select policy lets the client's own session see which of
-- their findings they've already flagged, so a reload doesn't silently
-- forget and let them submit duplicate feedback.
create policy "owner reads own finding feedback" on finding_feedback
  for select using (
    company_id in (select id from companies where user_id = auth.uid())
  );
