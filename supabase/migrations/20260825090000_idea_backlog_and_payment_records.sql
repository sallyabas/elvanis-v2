-- Two independent admin/backend pieces (confirmed 2026-08-25, direct
-- founder request).

-- 1. Internal idea/feedback backlog — a real, structured table (not a
-- notes/JSON blob) so a future AI-assisted-expansion step can reliably
-- read individual fields later, per explicit instruction. Deliberately
-- NOT RLS-protected — same precedent already used for `pricing` and
-- `app_settings`, both genuinely internal-only tables touched exclusively
-- by the admin client from reviewer-only Server Actions, never by any
-- client-facing or session-scoped code path. AI-assisted expansion of a
-- raw idea into a feature brief is explicitly held for a future pass, not
-- built here.
create type idea_source as enum ('own_idea', 'client_feedback', 'third_party');
create type idea_status as enum ('new', 'considering', 'in_progress', 'done', 'declined');

create table idea_backlog (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  source idea_source not null,
  status idea_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Payment records — one shared, polymorphic table across every
-- payable item (module_requests, execution_sprints, session_requests,
-- reports for paid re-audits), rather than a `payment_status` column
-- bolted separately onto four different tables. Same "polymorphic
-- reference validated in application code, not the DB" pattern already
-- used for `finding_feedback` (which spans lens_findings/module_findings)
-- — entity_id has no FK since it points at different tables depending on
-- entity_type. No payment gateway involved anywhere in this app (same
-- "manual Stripe link, reviewer records what happened" pattern already
-- established for Execution Sprint/Concierge) — this table is a record of
-- what the reviewer knows, not something that processes money itself.
create type payment_entity_type as enum ('module_request', 'execution_sprint', 'session_request', 'report');
create type payment_status_value as enum ('not_applicable', 'unpaid', 'invoiced', 'paid');

create table payment_records (
  id uuid primary key default gen_random_uuid(),
  entity_type payment_entity_type not null,
  entity_id uuid not null,
  status payment_status_value not null default 'not_applicable',
  amount numeric,
  currency text default 'GBP',
  notes text,
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id)
);
