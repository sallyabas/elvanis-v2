-- DIFC "stable arrangements" question (confirmed 2026-09-04, direct
-- founder request) — DIFC Data Protection Law No. 5 of 2020 has a real,
-- narrower-than-GDPR extraterritorial-adjacent concept: an entity
-- processing data WITHIN DIFC "as part of stable arrangements," even
-- without formal DIFC incorporation. `uae_free_zone` reflects registration
-- only, not this operational-presence question — this is a genuinely
-- separate signal, deliberately its own field rather than folded into
-- uae_free_zone.
--
-- Tri-state, nullable — "not yet answered" is distinct from a real "no".
-- "not_sure" is itself a real, meaningful answer (not an absence of one):
-- it routes the client to a "Book a Discovery Session" link and flags the
-- account for reviewer visibility on /company/[companyId], rather than
-- silently defaulting to "no".
alter table companies
  add column difc_stable_arrangements text check (difc_stable_arrangements in ('yes', 'no', 'not_sure'));

comment on column companies.difc_stable_arrangements is
  'Does the company have staff or systems physically located within DIFC on an ongoing/contractual basis (DIFC Data Protection Law''s "stable arrangements" concept)? NULL = not yet asked. "not_sure" is a real answer, not a missing one — surfaced to reviewers on /company/[companyId] and prompts a Discovery Session link.';
