-- Real gap found while wiring the cron migration, not anticipated
-- upfront (confirmed 2026-09-05) — the original brief's own "What NOT to
-- build" section said no automated email alerts were needed for this new
-- tracker, but the founder's later "migrate the existing cron job... to
-- read from this new table" instruction means the ALREADY-LIVE
-- checkRegulatoryContentReviewDue() email-notification behavior is being
-- preserved, not eliminated — a real migration of existing working code,
-- not a fresh no-email build. That check needs the same idempotency
-- column the old regulatory_content_reviews table already had
-- (notified_at), or a 15-20 minute cron would re-notify every tick for as
-- long as a framework stayed overdue (the exact bug the old table's own
-- notified_at column was built to prevent, 2026-08-02).
--
-- Never editing an already-applied migration in place — this codebase's
-- standing discipline — hence a real follow-up file instead of amending
-- 20260905100000_regulatory_frameworks.sql.
alter table regulatory_frameworks add column notified_at timestamptz;

comment on column regulatory_frameworks.notified_at is
  'Set when checkRegulatoryFrameworksDue() last fired for this framework. Only re-fires if null or older than the current last_reviewed_at — idempotent per overdue cycle, not per cron tick.';
