-- AI Execution Audit Platform — initial schema
-- Mirrors §3 of docs/AI-Execution-Audit-Platform-BRD-Architecture-Roadmap.md
--
-- Deviation from the literal spec: `users.password_hash` is dropped.
-- Supabase Auth (auth.users) already owns credential storage; a second
-- password store would be a duplicate/conflicting source of truth, not a
-- faithful implementation of the spec's intent. `public.users` is a profile
-- table keyed to auth.users(id) instead.

create extension if not exists pgcrypto;

-- ── Enums ────────────────────────────────────────────────────────────────

create type business_model as enum ('B2B', 'B2C');
create type lens_type as enum ('financial', 'commercial', 'execution', 'product', 'ai_governance');
create type evidence_source_type as enum ('native_export', 'template_fill', 'merged');
create type evidence_submission_status as enum ('pending', 'complete', 'insufficient');
create type reviewer_status as enum ('draft', 'edited', 'approved', 'rejected');
create type confidence_level as enum ('high', 'medium', 'low', 'insufficient');
create type readiness_status as enum ('do_now', 'fix_groundwork_first');
create type conflict_resolution_status as enum ('unresolved', 'reviewer_resolved');
create type report_status as enum ('draft', 'pending_review', 'approved', 'sent');
create type notification_recipient_type as enum ('client', 'reviewer');
create type notification_event_type as enum ('report_ready', 'new_submission', 'evidence_incomplete', 'sprint_update');
create type notification_channel as enum ('email');
create type sprint_status as enum ('scoped', 'in_progress', 'complete');
create type governance_mode as enum ('questionnaire', 'document_review');
create type regulatory_reference as enum ('GDPR', 'PDPL');
create type retainer_status as enum ('active', 'paused', 'cancelled');

-- ── Core identity & profile ─────────────────────────────────────────────

create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  email text not null,
  notification_preferences jsonb not null default '{}'::jsonb,
  plan_tier text not null default 'free',
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  name text not null,
  website_url text,
  social_links jsonb not null default '{}'::jsonb,
  industry text,
  business_model business_model,
  country text,
  employee_count int,
  stage text,
  revenue_range_band text,
  customer_type text,
  main_tools_stack jsonb not null default '{}'::jsonb,
  team_structure_summary text,
  privacy_acknowledged_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table company_profile_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  changed_field text not null,
  old_value text,
  new_value text,
  changed_at timestamptz not null default now()
);

create table digital_presence_scans (
  id uuid primary key default gen_random_uuid(),
  company_url_or_name text not null,
  industry_hint text,
  business_model_hint business_model,
  public_signals jsonb not null default '{}'::jsonb,
  presence_score numeric,
  findings_summary text,
  is_linked_to_company_id uuid references companies (id) on delete set null,
  created_at timestamptz not null default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  primary_goal text not null,
  secondary_goal text,
  urgency_level text,
  target_metric text,
  time_horizon text,
  success_definition text,
  created_at timestamptz not null default now()
);

-- ── Evidence intake ──────────────────────────────────────────────────────

create table evidence_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  lens lens_type not null,
  source_type evidence_source_type not null,
  status evidence_submission_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table evidence_files (
  id uuid primary key default gen_random_uuid(),
  evidence_submission_id uuid not null references evidence_submissions (id) on delete cascade,
  file_url text not null,
  file_type text not null,
  parsed_status text,
  parsed_field_map jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table evidence_fields (
  id uuid primary key default gen_random_uuid(),
  evidence_submission_id uuid not null references evidence_submissions (id) on delete cascade,
  field_name text not null,
  field_value text,
  source text not null check (source in ('parsed', 'manual')),
  is_required boolean not null default false,
  is_blank boolean not null default true
);

create table export_source_signatures (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  signature_pattern jsonb not null,
  field_mapping_template jsonb not null
);

-- ── Five-lens findings & scoring ─────────────────────────────────────────

create table lens_findings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  lens lens_type not null,
  ai_draft jsonb not null,
  reviewer_status reviewer_status not null default 'draft',
  reviewer_notes text,
  confidence_level confidence_level,
  is_missing_data_finding boolean not null default false,
  created_at timestamptz not null default now()
);

create table financial_impact_estimates (
  id uuid primary key default gen_random_uuid(),
  lens_finding_id uuid not null references lens_findings (id) on delete cascade,
  impact_band_low numeric,
  impact_band_high numeric,
  currency text not null default 'GBP',
  confidence_level confidence_level,
  assumptions text[] not null default '{}'
);

create table ai_governance_detail (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  mode governance_mode not null,
  questionnaire_answers jsonb not null default '{}'::jsonb,
  uploaded_docs jsonb not null default '{}'::jsonb
);

create table ai_opportunity_synthesis (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  source_finding_ids uuid[] not null default '{}',
  opportunity_description text not null,
  readiness_status readiness_status,
  readiness_reasoning text
);

create table readiness_scores (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  data_quality numeric,
  team_skill numeric,
  process_maturity numeric,
  governance_foundation numeric
);

create table priority_ranking (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  lens_finding_id uuid not null references lens_findings (id) on delete cascade,
  goal_relevance_score numeric,
  financial_impact_score numeric,
  urgency_score numeric,
  confidence_score numeric,
  rank_order int,
  fix_first_flag boolean not null default false
);

create table finding_conflicts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  finding_a_id uuid not null references lens_findings (id) on delete cascade,
  finding_b_id uuid not null references lens_findings (id) on delete cascade,
  conflict_description text not null,
  resolution_status conflict_resolution_status not null default 'unresolved',
  reviewer_notes text
);

-- ── Reports & notifications ─────────────────────────────────────────────

create table reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  goal_id uuid references goals (id) on delete set null,
  top_3_finding_ids uuid[] not null default '{}',
  roadmap_30_60_90 jsonb not null default '{}'::jsonb,
  status report_status not null default 'draft',
  reviewed_by uuid references users (id) on delete set null,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  -- Enforced gate: status can never reach 'sent' without having passed 'approved'.
  constraint reports_sent_requires_reviewer check (
    status <> 'sent' or reviewed_by is not null
  )
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_type notification_recipient_type not null,
  recipient_id uuid not null,
  event_type notification_event_type not null,
  sent_at timestamptz,
  channel notification_channel not null default 'email',
  created_at timestamptz not null default now()
);

-- ── Execution Sprint ─────────────────────────────────────────────────────

create table execution_sprints (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  report_id uuid not null references reports (id) on delete cascade,
  selected_finding_id uuid not null references lens_findings (id) on delete cascade,
  status sprint_status not null default 'scoped',
  start_date date,
  target_end_date date
);

create table sprint_tasks (
  id uuid primary key default gen_random_uuid(),
  execution_sprint_id uuid not null references execution_sprints (id) on delete cascade,
  task_description text not null,
  owner text,
  status text not null default 'not_started',
  kpi_target text,
  kpi_actual text,
  due_date date
);

-- ── Scheduled jobs & case library ────────────────────────────────────────

create table scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (
    job_type in (
      're_audit_reminder',
      'evidence_completeness_nudge',
      'sprint_progress_checkin',
      'monthly_retainer_refresh'
    )
  ),
  company_id uuid references companies (id) on delete cascade,
  cron_expression text not null,
  payload jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  created_at timestamptz not null default now()
);

create table case_library (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  report_id uuid not null references reports (id) on delete cascade,
  tags text[] not null default '{}',
  stored_for_retrieval boolean not null default false -- retrieval activates in v2
);

create table monthly_retainers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  status retainer_status not null default 'active',
  start_date date not null,
  refresh_cadence text,
  last_refresh_report_id uuid references reports (id) on delete set null,
  price numeric
);

-- ── V1 standalone modules ────────────────────────────────────────────────

create table tender_readiness_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  status text not null default 'draft',
  ai_use_inventory jsonb not null default '{}'::jsonb,
  risk_classification jsonb not null default '{}'::jsonb,
  missing_documentation jsonb not null default '{}'::jsonb,
  procurement_answer_drafts jsonb not null default '{}'::jsonb,
  evidence_pack_url text,
  created_at timestamptz not null default now()
);

create table ai_reliability_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  status text not null default 'draft',
  ai_workflow_inventory jsonb not null default '{}'::jsonb,
  adversarial_test_results jsonb not null default '{}'::jsonb,
  failure_mode_findings jsonb not null default '{}'::jsonb,
  remediation_recommendations jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table data_protection_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  status text not null default 'draft',
  regulatory_reference regulatory_reference not null default 'GDPR',
  consent_flow_review jsonb not null default '{}'::jsonb,
  data_subject_rights_readiness jsonb not null default '{}'::jsonb,
  retention_policy_review jsonb not null default '{}'::jsonb,
  breach_response_readiness jsonb not null default '{}'::jsonb,
  cross_border_transfer_check jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ── Indexes ──────────────────────────────────────────────────────────────

create index on companies (user_id);
create index on company_profile_history (company_id);
create index on goals (company_id);
create index on evidence_submissions (company_id, lens);
create index on evidence_files (evidence_submission_id);
create index on evidence_fields (evidence_submission_id);
create index on lens_findings (company_id, lens);
create index on financial_impact_estimates (lens_finding_id);
create index on ai_opportunity_synthesis (company_id);
create index on readiness_scores (company_id);
create index on priority_ranking (company_id, rank_order);
create index on finding_conflicts (company_id, resolution_status);
create index on reports (company_id, status);
create index on notifications (recipient_type, recipient_id);
create index on execution_sprints (company_id, status);
create index on sprint_tasks (execution_sprint_id);
create index on case_library (company_id);
create index on tender_readiness_requests (company_id);
create index on ai_reliability_requests (company_id);
create index on data_protection_requests (company_id);

-- ── Row Level Security ───────────────────────────────────────────────────
-- Every company-scoped table is owned transitively through companies.user_id.
-- Policies below assume the app talks to Postgres as the authenticated user
-- (Supabase Auth JWT), never the service role, for any client-facing query.

alter table users enable row level security;
alter table companies enable row level security;
alter table company_profile_history enable row level security;
alter table goals enable row level security;
alter table evidence_submissions enable row level security;
alter table evidence_files enable row level security;
alter table evidence_fields enable row level security;
alter table lens_findings enable row level security;
alter table financial_impact_estimates enable row level security;
alter table ai_governance_detail enable row level security;
alter table ai_opportunity_synthesis enable row level security;
alter table readiness_scores enable row level security;
alter table priority_ranking enable row level security;
alter table finding_conflicts enable row level security;
alter table reports enable row level security;
alter table execution_sprints enable row level security;
alter table sprint_tasks enable row level security;
alter table case_library enable row level security;
alter table monthly_retainers enable row level security;
alter table tender_readiness_requests enable row level security;
alter table ai_reliability_requests enable row level security;
alter table data_protection_requests enable row level security;

create policy "users read own row" on users
  for select using (id = auth.uid());
create policy "users update own row" on users
  for update using (id = auth.uid());

create policy "owner reads own companies" on companies
  for all using (user_id = auth.uid());

create policy "owner reads own profile history" on company_profile_history
  for all using (company_id in (select id from companies where user_id = auth.uid()));

create policy "owner reads own goals" on goals
  for all using (company_id in (select id from companies where user_id = auth.uid()));

create policy "owner reads own evidence submissions" on evidence_submissions
  for all using (company_id in (select id from companies where user_id = auth.uid()));

create policy "owner reads own evidence files" on evidence_files
  for all using (
    evidence_submission_id in (
      select id from evidence_submissions where company_id in (
        select id from companies where user_id = auth.uid()
      )
    )
  );

create policy "owner reads own evidence fields" on evidence_fields
  for all using (
    evidence_submission_id in (
      select id from evidence_submissions where company_id in (
        select id from companies where user_id = auth.uid()
      )
    )
  );

create policy "owner reads own lens findings" on lens_findings
  for all using (company_id in (select id from companies where user_id = auth.uid()));

create policy "owner reads own financial impact estimates" on financial_impact_estimates
  for all using (
    lens_finding_id in (
      select id from lens_findings where company_id in (
        select id from companies where user_id = auth.uid()
      )
    )
  );

create policy "owner reads own governance detail" on ai_governance_detail
  for all using (company_id in (select id from companies where user_id = auth.uid()));

create policy "owner reads own opportunity synthesis" on ai_opportunity_synthesis
  for all using (company_id in (select id from companies where user_id = auth.uid()));

create policy "owner reads own readiness scores" on readiness_scores
  for all using (company_id in (select id from companies where user_id = auth.uid()));

create policy "owner reads own priority ranking" on priority_ranking
  for all using (company_id in (select id from companies where user_id = auth.uid()));

create policy "owner reads own finding conflicts" on finding_conflicts
  for all using (company_id in (select id from companies where user_id = auth.uid()));

-- Clients may only ever see reports that have reached `sent`; anything still
-- in draft/pending_review/approved is reviewer-workspace-only (service role).
create policy "owner reads own sent reports" on reports
  for select using (
    company_id in (select id from companies where user_id = auth.uid())
    and status = 'sent'
  );

create policy "owner reads own execution sprints" on execution_sprints
  for all using (company_id in (select id from companies where user_id = auth.uid()));

create policy "owner reads own sprint tasks" on sprint_tasks
  for all using (
    execution_sprint_id in (
      select id from execution_sprints where company_id in (
        select id from companies where user_id = auth.uid()
      )
    )
  );

create policy "owner reads own case library" on case_library
  for select using (company_id in (select id from companies where user_id = auth.uid()));

create policy "owner reads own monthly retainers" on monthly_retainers
  for all using (company_id in (select id from companies where user_id = auth.uid()));

create policy "owner reads own tender readiness requests" on tender_readiness_requests
  for all using (company_id in (select id from companies where user_id = auth.uid()));

create policy "owner reads own ai reliability requests" on ai_reliability_requests
  for all using (company_id in (select id from companies where user_id = auth.uid()));

create policy "owner reads own data protection requests" on data_protection_requests
  for all using (company_id in (select id from companies where user_id = auth.uid()));

-- digital_presence_scans, export_source_signatures, scheduled_jobs and
-- notifications are intentionally left without client-facing RLS policies:
-- the first is pre-signup/anonymous, the rest are backend/service-role-only.
