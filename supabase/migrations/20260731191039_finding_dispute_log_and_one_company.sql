-- Confirmed 2026-07-31 (see CLAUDE.md "SLA, submission flow & business rules"):
--
-- 1. lens_findings gets pure data-capture columns for a future auto-approve
--    design — no auto-approve mechanism exists yet, mandatory review is
--    unchanged. Commercial/Market's hybrid design needs client source
--    tagging (client_reported vs ai_independent) and a dispute flow: the
--    client marks an ai_independent finding not_confident -> it's dropped
--    from client view but still surfaced to the reviewer for resolution.
--
-- 2. companies.user_id gets a unique constraint: one company per account
--    for V1 (no multi-company support yet), enforced at the DB level rather
--    than a UI convention, same philosophy as the mandatory review gate.

alter table lens_findings
  add column origin text check (origin in ('client_reported', 'ai_independent')),
  add column client_confidence_marking text check (client_confidence_marking in ('accurate', 'not_confident')),
  add column is_disputed boolean not null default false,
  add column dispute_resolution_notes text;

comment on column lens_findings.origin is
  'Client-facing source tag: client_reported (client told us) vs ai_independent (system found this on its own). Currently used by Commercial/Market; null where the distinction does not apply.';
comment on column lens_findings.client_confidence_marking is
  'Client''s own accuracy marking on an ai_independent finding. Drives whether it stays visible to the client — see is_disputed.';
comment on column lens_findings.is_disputed is
  'True when the client marks an ai_independent finding not_confident: dropped from client view, still surfaced to the reviewer for resolution.';
comment on column lens_findings.dispute_resolution_notes is
  'Reviewer''s resolution notes for a disputed finding.';

alter table companies
  add constraint companies_user_id_unique unique (user_id);
