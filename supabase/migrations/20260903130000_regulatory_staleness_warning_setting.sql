-- Real, admin-adjustable setting for the new in-workspace regulatory
-- staleness warning (confirmed 2026-09-03, direct founder request) —
-- deliberately its own separate value, NOT reusing
-- regulatory_content_review_days (180, the pre-existing /queue panel's
-- own maintenance cadence) — the two answer genuinely different
-- questions (see regulatory-staleness.ts's own docblock). Seeded to 90
-- per the founder's own explicit example.
insert into app_settings (key, value) values
  ('regulatory_staleness_warning_days', '90');
