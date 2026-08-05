-- Real bug found and fixed while testing (2026-08-02): the original check
-- had no idempotency at all — on a 15-minute cron it would notify every
-- reviewer every 15 minutes for as long as a jurisdiction stayed overdue,
-- not once. Same idempotency pattern as reports.reviewer_notified_at.

alter table regulatory_content_reviews
  add column notified_at timestamptz;

comment on column regulatory_content_reviews.notified_at is
  'Set when checkRegulatoryContentReviewDue() last fired for this jurisdiction. Only re-fires if null or older than the current last_reviewed_at (i.e. a fresh overdue cycle since the last human review).';
