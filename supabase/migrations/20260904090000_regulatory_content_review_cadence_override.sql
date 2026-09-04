-- Per-jurisdiction review-cadence override (confirmed 2026-09-04, direct
-- founder request during DIFC coverage) — regulatory_content_reviews has
-- only ever had ONE global cadence (app_settings.regulatory_content_review_days,
-- 180) applying identically to every jurisdiction. DIFC needs a shorter
-- cadence than that: its own data-protection regime has seen real,
-- scope-expanding amendments that may or may not have already taken
-- effect (actively in flux, per direct research), unlike the more settled
-- regimes already tracked here.
--
-- Nullable, not a second global setting or a hardcoded special case — null
-- means "use the global regulatory_content_review_days default," exactly
-- the existing behavior for every jurisdiction already seeded. Only
-- DIFC's row gets a real override value below.
alter table regulatory_content_reviews
  add column review_cadence_days integer;

comment on column regulatory_content_reviews.review_cadence_days is
  'Per-jurisdiction override for how often this jurisdiction''s regulatory content should be re-checked. NULL means fall back to app_settings.regulatory_content_review_days (the global default, 180). Set for jurisdictions known to be more actively in flux than the rest.';

-- DIFC Data Protection Law No. 5 of 2020 — built as a real branch today
-- (see jurisdiction.ts's own docblock for the full research and sources).
-- Seeded with today's date (when it was actually researched and built,
-- same discipline as every other jurisdiction seed in this table) and a
-- real 90-day cadence override, not the global 180 — DIFC's own regime
-- has seen real, scope-expanding amendments that may or may not have
-- already taken effect, confirmed as actively in flux by direct research,
-- distinct from the more settled regimes already tracked here.
insert into regulatory_content_reviews (jurisdiction, last_reviewed_at, review_cadence_days) values
  ('difc_dpl', '2026-09-04T00:00:00Z', 90);
