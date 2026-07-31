-- Split companies.country into two independent jurisdiction signals.
--
-- Regulatory applicability isn't one "country" — it's two separate triggers:
-- - EU AI Act, GDPR, and Saudi PDPL are extraterritorial: triggered by where
--   CUSTOMERS/END-USERS are.
-- - UAE's DIFC Regulation 10 and ADGM rules are triggered by where the
--   COMPANY ITSELF is registered.
-- These can both apply simultaneously to the same company. See CLAUDE.md
-- "Multi-jurisdiction regulatory landscape" for the underlying research.

alter table companies
  drop column country,
  add column registration_country text,
  add column uae_free_zone text check (uae_free_zone in ('mainland', 'difc', 'adgm')),
  add column customer_market_countries text[] not null default '{}';

comment on column companies.registration_country is
  'Where the company is legally registered (e.g. UK, NL, UAE, SA). Drives UAE free-zone-specific rules (DIFC Reg 10, ADGM DPR 2021).';
comment on column companies.uae_free_zone is
  'Only meaningful when registration_country = UAE. NULL/absent = UAE mainland (federal PDPL only, no DIFC/ADGM-specific regime).';
comment on column companies.customer_market_countries is
  'Where end-users/customers are located. Drives extraterritorial regimes: EU AI Act, GDPR, Saudi PDPL.';
