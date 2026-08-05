-- Generic standalone-module review architecture (confirmed 2026-08-02).
--
-- AI Reliability Audit, Tender Readiness, and Data Protection Compliance
-- all hit the same question: how do their findings get reviewed? Same
-- principle already used for AI & Governance not being forced into the
-- shared LensModule interface — reuse the REVIEW MECHANISM (Accept/Edit/
-- Reject/Approve, the confidence/edit-tracking log, the reviewer queue),
-- but don't force module findings into lens_findings' exact structure —
-- that schema carries core-audit-specific fields (goalRelevance tied to
-- the 5-goal menu, financialImpact) that don't genuinely apply to a
-- standalone module. Solved generically once, not as a one-off for
-- AI Reliability with Tender Readiness/Data Protection repeating the
-- question right behind it.
--
-- Replaces the three separate *_requests tables (tender_readiness_requests,
-- ai_reliability_requests, data_protection_requests) — all three were still
-- completely empty and unreferenced by any application code (a v0 scaffold
-- that predates the lens architecture's findings-structure lessons), so
-- dropping and replacing needs no backfill. Their module-specific jsonb
-- "result" columns (ai_workflow_inventory, risk_classification, etc.) are
-- superseded by module_findings' structured ai_draft; genuinely
-- module-specific INTAKE data (which differs per module and doesn't
-- generalize) now lives in module_requests.intake_data instead.

drop table if exists tender_readiness_requests;
drop table if exists ai_reliability_requests;
drop table if exists data_protection_requests;

create type module_type as enum ('ai_reliability', 'tender_readiness', 'data_protection');

-- The module-level container — same role reports plays for the core audit
-- (review gate, edit window, delivery), reusing the exact same report_status
-- enum and the exact same "sent requires a reviewer" invariant.
create table module_requests (
  id uuid primary key default gen_random_uuid(),
  module_type module_type not null,
  company_id uuid not null references companies (id) on delete cascade,
  status report_status not null default 'pending_review',
  intake_data jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  edit_window_closes_at timestamptz,
  reviewer_notified_at timestamptz,
  reviewed_by uuid references users (id) on delete set null,
  approved_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint module_requests_sent_requires_reviewer check (
    status <> 'sent' or reviewed_by is not null
  )
);

-- The finding-level table — same role lens_findings plays, reusing the
-- exact same reviewer_status enum and the same ai_draft/reviewer_edited_content
-- immutable-original-vs-edited pattern. Deliberately does NOT carry
-- goalRelevance/financialImpact/origin/dispute fields — those are
-- core-audit-specific, not generic to every module.
create table module_findings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references module_requests (id) on delete cascade,
  module_type module_type not null,
  ai_draft jsonb not null,
  reviewer_status reviewer_status not null default 'draft',
  reviewer_notes text,
  reviewer_edited_content jsonb,
  confidence_level confidence_level,
  is_missing_data_finding boolean not null default false,
  created_at timestamptz not null default now()
);

create index on module_requests (company_id);
create index on module_findings (request_id);

alter table module_requests enable row level security;
alter table module_findings enable row level security;

create policy "owner reads own module requests" on module_requests
  for all using (company_id in (select id from companies where user_id = auth.uid()));

create policy "owner reads own module findings" on module_findings
  for all using (
    request_id in (
      select mr.id from module_requests mr
      join companies c on c.id = mr.company_id
      where c.user_id = auth.uid()
    )
  );
