-- Reviewer Notes — per-company structured list (confirmed 2026-09-05,
-- direct founder decision) — a real, structured log, not free text: every
-- entry has a mandatory Date, a mandatory Name (a short label/title, NOT
-- a person's name — e.g. "Discovery Session — completed"), and a
-- Description (the actual note content). Two ways an entry gets created:
-- (1) automatically, when a service/session reaches Completed status via
-- service_status_records (see that table's own docblock for the full
-- two-way-creation/one-way-editing design); (2) manually, added directly
-- by the reviewer, anytime, via the same three fields. `source`
-- distinguishes the two for display purposes only — both are equally
-- real, equally editable entries once created.
create type reviewer_note_source as enum ('manual', 'service_status');

create table reviewer_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  entry_date timestamptz not null,
  name text not null,
  description text not null default '',
  source reviewer_note_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reviewer_notes_company_id_idx on reviewer_notes (company_id, entry_date desc);
