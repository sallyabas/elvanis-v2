-- Reviewer Notes — real per-request association (confirmed 2026-09-08,
-- item 6 of the final status-flow spec: /company/[companyId]'s
-- reorganized "Activity & Requests, grouped by individual request" +
-- "General Reviewer Notes" split). Nullable both, not two separate
-- columns per row-shape — null means "general, not tied to any single
-- request" (Group 3's own real definition), a non-null pair means "tied
-- to this specific request" (shown inline under that request in Group 2).
--
-- Reuses the existing `payment_entity_type` enum (module_request/
-- execution_sprint/session_request/report — service_status_records' own
-- type) rather than inventing a new one — the same 4 real entity kinds
-- apply here, and this is the exact reuse precedent already established
-- for that enum (see payment-records.ts's own docblock).
--
-- Every existing note stays null (genuinely general) after this
-- migration — no fabricated backfill guessing which historical note
-- belonged to which request; only new notes going forward can carry a
-- real association.
alter table reviewer_notes add column related_entity_type payment_entity_type;
alter table reviewer_notes add column related_entity_id uuid;

create index reviewer_notes_related_entity_idx on reviewer_notes (related_entity_type, related_entity_id);
