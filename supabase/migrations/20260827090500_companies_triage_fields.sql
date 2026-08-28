-- Path B triage question answers (confirmed 2026-08-27, Onboarding
-- Architecture & Path Routing brief, Part 8c, extended same day with the
-- founder's own third-question refinement) — three dedicated, queryable
-- columns on the company record, not a JSON blob, since these directly
-- drive: the routing-matrix decision at onboarding time, the conditional
-- AI Status card on the Business Health dashboard (Part 5), the AI &
-- Governance report callout (Part 7 item 8 — that callout deliberately
-- keeps reading the frozen per-report snapshot, not these live columns;
-- see companies_has_ai_in_production.sql's own docblock for why), and
-- reviewer-workspace urgency flagging.
--
-- Deliberately NOT reusing companies.has_ai_in_production for the AI-usage
-- question — confirmed different shape (a plain boolean vs. this brief's
-- 4-option triage: customer-facing / internal-only / exploring / not
-- sure) during the architecture review before building. Both columns
-- coexist; has_ai_in_production stays the plain "yes/no, any answer
-- anywhere in the app" signal, triage_ai_usage is this specific,
-- richer, onboarding-time answer.
--
-- All three nullable — "not asked yet" (a company onboarded before this
-- brief, or one on Path A that never took the Path B triage) is a real,
-- distinct state from any real answer, same discipline as
-- has_ai_in_production/kpi_unit/business_model elsewhere in this codebase.
alter table companies
  add column triage_ai_usage text check (triage_ai_usage in ('customer_facing', 'internal_only', 'exploring', 'not_sure')),
  add column triage_compliance_request text check (triage_compliance_request in ('active_request', 'want_ahead', 'not_applicable')),
  add column triage_personal_data text check (triage_personal_data in ('yes', 'no', 'not_sure'));

comment on column companies.triage_ai_usage is
  'Path B triage Q1: "Are you currently using AI in any production or customer-facing workflow?" Drives module routing and the conditional AI Status card.';
comment on column companies.triage_compliance_request is
  'Path B triage Q2: "Have you recently received a compliance/procurement request about your AI?" active_request routes toward urgency + human consultation regardless of Q1.';
comment on column companies.triage_personal_data is
  'Path B triage Q3 (added 2026-08-27 refinement): "Does your business process or store customer or employee personal data?" Drives Data Protection Compliance routing directly — never inferred from the AI-usage answer, since AI usage and personal-data handling are independent signals.';
