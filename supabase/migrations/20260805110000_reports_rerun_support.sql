-- Basic re-run/refresh button (confirmed 2026-08-05, pulled forward from
-- V2 — "doesn't need real case history at all; only a future retrieval-
-- informed upgrade does"). Real prerequisite gap found while building
-- this, not anticipated upfront: the fill-in-template evidence intake path
-- has never persisted its raw evidence anywhere (confirmed by querying
-- evidence_submissions/evidence_fields for real companies and finding zero
-- rows) — there was nothing to actually "re-run" against. Closed properly
-- here rather than faked: `source_evidence_snapshot` stores the exact
-- evidence payload runAudit() was called with at submission time, so a
-- later re-run can reuse it. `rerun_of_report_id` links a re-run's new
-- report back to the one it re-ran, for traceability — nullable, since a
-- normal first-time submission isn't a re-run of anything.
--
-- Only reports created AFTER this migration will have a snapshot — older
-- reports genuinely cannot be re-run (source_evidence_snapshot is null for
-- them), and the re-run function refuses rather than fabricating evidence
-- to fill the gap.

alter table reports add column source_evidence_snapshot jsonb;
alter table reports add column rerun_of_report_id uuid references reports (id) on delete set null;
