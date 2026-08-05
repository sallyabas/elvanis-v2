-- Saved draft intake (confirmed 2026-08-05, pulled forward from V2) — pure
-- UX, no case-history dependency, no reason to wait. One draft row per
-- company: the Evidence Intake form is the longest, most-worth-pausing
-- client-facing form (12 free-text fields across Financial/Execution/
-- Product, 4 Commercial fields, plus AI & Governance), unlike the shorter
-- onboarding wizard. draft_data is a raw JSON blob mirroring the form's own
-- local state shape — deliberately not normalized into typed columns, since
-- this is throwaway in-progress state, not a permanent record; the real
-- submission still goes through the full typed runAudit() path.

create table evidence_intake_drafts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade unique,
  draft_data jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table evidence_intake_drafts enable row level security;

create policy "owner reads/writes own draft" on evidence_intake_drafts
  for all using (
    company_id in (select id from companies where user_id = auth.uid())
  );
