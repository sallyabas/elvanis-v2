-- Real paid_at timestamp, three payment-gated tables (confirmed
-- 2026-09-08, Reviewer Home page build, item 7) — none of module_requests/
-- execution_sprints/pending_evidence_submissions has ever recorded the
-- moment payment actually cleared; each only ever flips its own
-- payment_status enum to 'paid' with no timestamp captured. This closes
-- that gap for two real, confirmed needs at once: the Home page's
-- "recently active = paid for a service or received a report" clients
-- widget, and the Requests widget's own "Paid" rollup bucket — both would
-- otherwise need to approximate off unrelated columns (delivered_at,
-- start_date) that don't actually mark the payment moment.
--
-- Nullable, no backfill — a row already 'paid' before this migration has
-- no real moment to backfill honestly (same "never fabricate a plausible-
-- looking timestamp" discipline already applied elsewhere in this
-- codebase, e.g. regulatory_frameworks.source_url). Stamped going forward
-- only, at the exact point each table's own "mark paid" function already
-- flips payment_status.

alter table module_requests add column paid_at timestamptz;
alter table execution_sprints add column paid_at timestamptz;
alter table pending_evidence_submissions add column paid_at timestamptz;
