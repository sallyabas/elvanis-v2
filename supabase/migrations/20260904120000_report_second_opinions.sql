-- Reviewer report-level "second opinion" (confirmed 2026-09-04) — a real,
-- separate feature alongside the per-finding second opinion
-- (finding_second_opinions), not a replacement for it. Checks the
-- report's actual Top 3 selection (and its own recommended actions) as a
-- whole, against the client's stated goal and the real "Goal Relevance
-- Ranking Rubric" (see src/lib/reports/ranking-rubric.ts). Purely
-- advisory — never a gate, never client-facing.
--
-- Deliberately its own table, not reused from finding_second_opinions:
-- the subject here is a report-level SELECTION across multiple findings,
-- not one specific finding, so `concerns` is a real jsonb array (each
-- with its own category/findingIds/reasoning) rather than one row per
-- concern — a report can have more than one thing wrong with its Top 3
-- at once, and this keeps one second-opinion request as one row.
--
-- No RLS — purely internal reviewer tooling, same treatment as
-- finding_second_opinions/pricing/app_settings/idea_backlog. Every access
-- goes through the admin client from a reviewer-checked Server Action.
create table report_second_opinions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  -- Array of {category, findingIds, reasoning} objects — validated and
  -- normalized in application code (normalizeReportSecondOpinionResponse(),
  -- see src/lib/reviewer/report-second-opinion.ts) before being persisted,
  -- never trusted from the model's own response alone.
  concerns jsonb not null default '[]'::jsonb,
  overall_assessment text not null,
  model text not null,
  requested_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on report_second_opinions (report_id);

comment on table report_second_opinions is
  'Reviewer-triggered, on-demand second opinion on a report''s actual Top 3 selection vs. the client''s stated goal, using the Goal Relevance Ranking Rubric as instructions. Purely advisory - never a gate, never client-facing.';
