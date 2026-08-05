-- Pricing table (confirmed 2026-08-06) — same "admin-adjustable, not a
-- constant" principle already used for app_settings (re-audit cadence,
-- evidence-completeness nudge). Pricing must be able to change based on
-- real pilot learnings without a redeploy, so it lives in the DB, never
-- as a literal in application code or only in the spec doc.
create table pricing (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  display_name text not null,
  price_amount numeric not null,
  currency text not null default 'GBP',
  is_placeholder boolean not null default false,
  notes text,
  updated_at timestamptz not null default now()
);

-- Seed data: the confirmed v1 launch numbers (2026-08-06). These are the
-- INITIAL values only, not treated as permanent literals — this table is
-- the live source of truth from here on, editable via the reviewer-facing
-- Pricing panel on /queue (see src/lib/pricing.ts).
insert into pricing (item_key, display_name, price_amount, currency, is_placeholder, notes) values
  ('standard_core_audit', 'Standard Core Audit', 0, 'GBP', false, 'Free tier — first completed audit per company only; re-audits are always paid.'),
  ('concierge_tier', 'Concierge tier (bundles Discovery + Delivery Sessions)', 300, 'GBP', false, null),
  ('execution_sprint', 'Execution Sprint', 3000, 'GBP', false, null),
  ('tender_readiness', 'Tender Readiness', 2500, 'GBP', false, null),
  ('ai_reliability_audit', 'AI Reliability Audit', 2000, 'GBP', false, null),
  ('data_protection_compliance', 'Data Protection Compliance', 2000, 'GBP', false, null),
  ('f2f_workshop', 'F2F Workshop add-on', 750, 'GBP', false, null),
  ('monthly_execution_office', 'Monthly Execution Office', 500, 'GBP', true, 'Placeholder — cannot be finalized without repeat-client signal.');
