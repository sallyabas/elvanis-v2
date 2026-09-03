-- UAE federal PDPL + ADGM DPR 2021, built for real 2026-09-03 (the "gated
-- on real UAE client exposure" gate confirmed lifted) — same generic
-- regulatory_content_reviews mechanism, zero code change needed to
-- support two more jurisdiction keys, same discipline as the 2026-08-03
-- Saudi PDPL/GDPR seed. Both use 2026-09-03 (today — when both regimes
-- were actually researched and built as real branches, not deferred).

insert into regulatory_content_reviews (jurisdiction, last_reviewed_at) values
  ('uae_pdpl', '2026-09-03T00:00:00Z'),
  ('adgm_dpr', '2026-09-03T00:00:00Z');
