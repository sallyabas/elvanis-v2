-- Real gap found and closed 2026-08-03: regulatory_content_reviews only
-- ever covered Tender Readiness's three AI-specific sections
-- (eu_ai_act, uae_difc_reg10, saudi_ai_governance) — Data Protection
-- Compliance's regulations (GDPR variants, and now Saudi PDPL) were never
-- added, even though the mechanism itself is fully generic and needed no
-- code change to support them. Seeded with the actual research/build
-- dates, same discipline as the original seed: uk_gdpr/eu_gdpr use
-- 2026-07-31 (when §1.8a/§1.8c's GDPR research was actually done);
-- saudi_pdpl uses 2026-08-03 (today — when PDPL was actually researched
-- and built as a real branch, not deferred).

insert into regulatory_content_reviews (jurisdiction, last_reviewed_at) values
  ('uk_gdpr', '2026-07-31T00:00:00Z'),
  ('eu_gdpr', '2026-07-31T00:00:00Z'),
  ('saudi_pdpl', '2026-08-03T00:00:00Z');
