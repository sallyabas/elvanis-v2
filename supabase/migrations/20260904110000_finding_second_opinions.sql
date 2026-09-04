-- Reviewer "second opinion" feature (confirmed 2026-09-04) — a structured,
-- reviewer-triggered-on-demand second opinion from a genuinely different
-- model (Claude, via src/lib/second-opinion-client) than whatever drafted
-- the finding (Groq, via src/lib/ai-client), using the finding's own lens
-- rubric as the second opinion's own instructions. Purely advisory — never
-- a gate. The DB-level mandatory-review-gate (reports_sent_requires_reviewer
-- and the equivalent module-review flow) remains the only real enforcement;
-- this table has no interaction with it whatsoever.
--
-- Same polymorphic-note shape as finding_feedback (confirmed 2026-09-03) —
-- finding_id has no FK, since a finding can be either a core-audit
-- lens_findings row or (once v1 is validated and extended) a standalone-
-- module module_findings row; finding_source distinguishes which.
-- Ownership/ANY access control is verified in application code before
-- every insert/read (this is reviewer-only tooling, never client-facing),
-- same reasoning finding_feedback's own migration already documents for
-- why RLS alone can't validate a cross-table polymorphic reference.
--
-- v1 scope (confirmed 2026-09-04): core-audit lens_findings only. The
-- module_finding source value is included now for the same reason
-- finding_feedback included both from day one — so the schema doesn't need
-- a second migration once modules are added, though nothing writes
-- 'module_finding' yet.
--
-- No RLS — this is purely internal reviewer tooling, never read or written
-- by a client session, same treatment as pricing/app_settings/idea_backlog.
-- Every access goes through the admin client from reviewer-only Server
-- Actions, which independently re-check session + role (see
-- src/lib/reviewer/second-opinion-workspace.ts).
create type finding_second_opinion_source as enum ('lens_finding', 'module_finding');

-- The controlled category vocabulary (confirmed 2026-09-04) — a free-text
-- "reasoning" field always accompanies this, but the category itself is a
-- fixed enum so the reviewer workspace UI can render a real, scannable
-- badge rather than requiring a full paragraph read every time. Mirrors
-- the same "controlled vocabulary over free text" discipline already used
-- for confidenceLevel/severity/goalRelevance across every lens.
--
-- 'unactionable_recommendation' (confirmed 2026-09-04, direct founder
-- request, added to the original 5-category proposal): the diagnosis is
-- correct, but recommendedAction is too vague or dependency-blocked for
-- the client to act on within 30 days — flagged as the single most common
-- real reviewer edit.
create type finding_second_opinion_category as enum (
  'possible_duplicate',
  'unsupported_confidence',
  'healthy_finding_miscategorized',
  'goal_relevance_mismatch',
  'unactionable_recommendation',
  'other'
);

create table finding_second_opinions (
  id uuid primary key default gen_random_uuid(),
  finding_source finding_second_opinion_source not null,
  finding_id uuid not null,
  concern boolean not null,
  -- Null exactly when concern = false — enforced deterministically in
  -- application code (normalizeSecondOpinionResponse(), see
  -- src/lib/reviewer/second-opinion.ts), never trusted from the model's
  -- own response alone.
  category finding_second_opinion_category,
  reasoning text not null,
  model text not null,
  requested_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index on finding_second_opinions (finding_source, finding_id);

comment on table finding_second_opinions is
  'Reviewer-triggered, on-demand second opinion from a separate model (Claude) on a single core-audit finding, using that lens''s own rubric as instructions. Purely advisory - never a gate, never client-facing. v1 scope: lens_finding only.';
