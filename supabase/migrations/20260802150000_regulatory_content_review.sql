-- Periodic regulatory-content-review flag (spec §1.8b, confirmed
-- 2026-08-02) — a distinct concern from re-audit reminders. Re-audit
-- reminders are about a CLIENT's data going stale; this is about the
-- REGULATORY REFERENCE CONTENT itself going stale — Saudi's Responsible AI
-- Policy is still in draft consultation, and the UAE's Federal Authority
-- for AI and Data (established June 2026) could issue binding rules
-- affecting DIFC Reg 10 or the AI Charter's status at any time. Reuses the
-- app_settings cadence pattern already built for re_audit_reminder_days,
-- not a new scheduling concept.

create table regulatory_content_reviews (
  jurisdiction text primary key,
  last_reviewed_at timestamptz not null,
  reviewed_by uuid references users (id) on delete set null
);

-- Seeded with the actual research date (§1.8c, 2026-07-31), not today —
-- the cadence timer starts from when the content was actually verified,
-- not artificially reset just because the tracking mechanism was built
-- later. uae_ai_charter_reference is deliberately excluded — it's
-- non-binding reference content, not a compliance obligation that can go
-- "out of date" the same way a binding regulation can.
insert into regulatory_content_reviews (jurisdiction, last_reviewed_at) values
  ('eu_ai_act', '2026-07-31T00:00:00Z'),
  ('uae_difc_reg10', '2026-07-31T00:00:00Z'),
  ('saudi_ai_governance', '2026-07-31T00:00:00Z');

insert into app_settings (key, value) values
  ('regulatory_content_review_days', '180');

alter type notification_event_type add value 'regulatory_content_review_due';
