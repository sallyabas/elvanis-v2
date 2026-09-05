-- Regulatory Freshness Tracker (confirmed 2026-09-05, build brief +
-- "revised decision" follow-up) — a real, full migration off the
-- pre-existing regulatory_content_reviews mechanism, not a second
-- parallel tracker. Direct founder reasoning: "since we're still in test
-- phase with no real customers, now is the cheap moment to do this
-- properly." regulatory_content_reviews itself is NOT dropped in this
-- migration — that's its own, deliberately separate, later step, done
-- only once the new table's cron/UI wiring is built and fully regression-
-- tested (see this session's own confirmed sequencing).
--
-- Real, confirmed schema differences from the old table, not
-- accidental drift: `review_notes`/`source_url` are genuinely new (the
-- old table never had either); `last_reviewed_at` is nullable here
-- (honestly reflecting "never yet reviewed" for 6 of the 10 seed rows,
-- a state the old table's design never needed); `staleness_threshold_days`
-- is a real, mandatory per-row value (not a nullable override falling
-- back to one global app_settings default, the old table's own design);
-- `last_reviewed_by` is plain text (not a FK to users — the old table's
-- FK made sense when only real signed-in reviewers ever touched it, but
-- this is a simpler, standalone admin field per the brief's own spec).

create table regulatory_frameworks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_code text not null unique,
  jurisdiction text not null,
  applicable_modules text[] not null default '{}',
  last_reviewed_at timestamptz,
  last_reviewed_by text,
  review_notes text,
  source_url text,
  staleness_threshold_days integer not null default 90,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column regulatory_frameworks.last_reviewed_at is
  'Nullable — null means "never yet reviewed under this new tracker," rendered as "Review pending" in RED from day one, not defaulted to a plausible-looking date.';

-- Seed, confirmed 2026-09-05 — dates reflect genuine research status
-- THIS session, not backfilled to match the old table's own (real,
-- earlier) research dates. UK GDPR and EU GDPR are deliberately kept as
-- two separate rows (not combined "UK/EU GDPR"), matching the real,
-- already-established distinction this codebase has maintained
-- elsewhere (different regulators, different post-Brexit adequacy
-- mechanisms — see data-protection-compliance/jurisdiction.ts). The four
-- UAE frameworks below get today's date; the other six get null.
--
-- source_url and review_notes are deliberately left NULL for every row —
-- not fabricated. This codebase's own standing rule is never to assert a
-- concrete factual claim (a URL, a document reference) without having
-- actually verified it via live research; none of that verification
-- happened in this pass, so leaving these genuinely blank for Sally to
-- fill in via the new admin page is the honest choice over guessing at
-- plausible-looking legislative URLs.
insert into regulatory_frameworks (name, short_code, jurisdiction, applicable_modules, last_reviewed_at, last_reviewed_by, staleness_threshold_days) values
  ('EU AI Act', 'eu_ai_act', 'EU', array['tender_readiness'], null, null, 90),
  ('UAE DIFC Regulation 10', 'uae_difc_reg10', 'UAE', array['tender_readiness'], now(), 'Sally Abas', 180),
  ('Saudi SDAIA', 'saudi_ai_governance', 'Saudi Arabia', array['tender_readiness'], null, null, 180),
  ('UK GDPR', 'uk_gdpr', 'UK', array['data_protection'], null, null, 180),
  ('EU GDPR', 'eu_gdpr', 'EU', array['data_protection'], null, null, 180),
  ('Saudi PDPL', 'saudi_pdpl', 'Saudi Arabia', array['data_protection'], null, null, 90),
  ('Article 4 AI Literacy', 'article_4_ai_literacy', 'EU', array['tender_readiness'], null, null, 90),
  ('UAE Federal PDPL', 'uae_pdpl', 'UAE', array['data_protection'], now(), 'Sally Abas', 180),
  ('ADGM DPR 2021', 'adgm_dpr', 'UAE (ADGM)', array['data_protection'], now(), 'Sally Abas', 180),
  ('DIFC Data Protection Law No. 5 of 2020', 'difc_dpl', 'UAE (DIFC)', array['data_protection'], now(), 'Sally Abas', 90);
