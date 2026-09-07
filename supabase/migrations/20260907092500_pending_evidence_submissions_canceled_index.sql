-- Split out from 20260907092000 (confirmed 2026-09-07) — Postgres refuses
-- to use a freshly-added enum value in the same transaction that added
-- it; this rebuild of the partial unique index (so a canceled re-audit
-- request frees its company's slot for a new one, same as 'completed'
-- already does) has to be its own, later migration.
drop index pending_evidence_submissions_one_active_per_company;
create unique index pending_evidence_submissions_one_active_per_company
  on pending_evidence_submissions (company_id)
  where status not in ('completed', 'canceled');
