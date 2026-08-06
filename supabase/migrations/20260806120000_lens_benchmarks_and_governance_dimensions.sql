-- Lens benchmarks + AI & Governance dimensions (confirmed 2026-08-06) —
-- closes the hardcoded-values audit's #1 finding: Financial/Execution/
-- Product benchmark thresholds were explicitly designed as "founder-set
-- starting points to refine with real pilot data" but were still plain
-- hardcoded TS constants, inconsistent with the pattern already
-- established for pricing/app_settings. GOVERNANCE_DIMENSIONS is treated
-- as a close cousin (same "explicitly provisional" language) and migrated
-- alongside it, per explicit direction. No admin UI exists yet for either
-- table — same "edit via direct SQL until one exists" precedent already
-- set by app_settings — not a gap, a deliberate scope boundary this round.
--
-- Per-boundary row shape (not a flat key/value copy of pricing) — each
-- individually named threshold is its own row, since several source
-- objects hold range/tuple boundaries (e.g. pr_cycle_time_hours.goodRange)
-- that don't fit a single flat value per metric.
create table lens_benchmarks (
  id uuid primary key default gen_random_uuid(),
  lens text not null,               -- 'financial' | 'execution' | 'product' | 'ai_governance'
  metric_key text not null,         -- e.g. 'gross_margin_percent', 'overall_maturity_total_score'
  metric_label text not null,       -- e.g. 'Gross margin'
  boundary_key text not null,       -- e.g. 'healthy_min', 'flag_below', 'nascent_max'
  value numeric not null,
  unit text,                        -- '%', 'months', 'hours', 'hours/week', 'days', 'score', null
  updated_at timestamptz not null default now(),
  unique (lens, metric_key, boundary_key)
);

create table governance_dimensions (
  dimension_key text primary key,   -- e.g. 'ai_use_inventory' — matches GovernanceDimensionKey, a fixed TS union
  label text not null,
  source text not null,
  sort_order integer not null,      -- preserves the original fixed rubric ordering
  level_0 text not null,            -- maturity level descriptions, 0-3 (absent/informal/partial/established)
  level_1 text not null,
  level_2 text not null,
  level_3 text not null,
  updated_at timestamptz not null default now()
);

-- Seed data: the exact values already live in
-- DEFAULT_FINANCIAL_BENCHMARKS / DEFAULT_EXECUTION_BENCHMARKS /
-- DEFAULT_PRODUCT_BENCHMARKS / DEFAULT_GOVERNANCE_MATURITY_TIER_BOUNDARIES /
-- DEFAULT_GOVERNANCE_DIMENSIONS (src/lib/lenses/*.ts) — those constants
-- remain the fallback + the documented source of truth for what was
-- seeded; this table is what becomes live-editable from here on.

insert into lens_benchmarks (lens, metric_key, metric_label, boundary_key, value, unit) values
  -- Financial
  ('financial', 'gross_margin_percent', 'Gross margin', 'healthy_min', 70, '%'),
  ('financial', 'gross_margin_percent', 'Gross margin', 'healthy_max', 80, '%'),
  ('financial', 'gross_margin_percent', 'Gross margin', 'flag_below', 70, '%'),
  ('financial', 'gross_margin_percent', 'Gross margin', 'concerning_below', 60, '%'),
  ('financial', 'cash_runway_months', 'Cash runway', 'critical_below', 6, 'months'),
  ('financial', 'cash_runway_months', 'Cash runway', 'warning_below', 12, 'months'),
  ('financial', 'cash_runway_months', 'Cash runway', 'healthy_at_or_above', 12, 'months'),
  ('financial', 'customer_concentration_percent', 'Customer revenue concentration', 'healthy_below', 10, '%'),
  ('financial', 'customer_concentration_percent', 'Customer revenue concentration', 'watch_below', 25, '%'),
  ('financial', 'customer_concentration_percent', 'Customer revenue concentration', 'elevated_risk_below', 35, '%'),
  ('financial', 'customer_concentration_percent', 'Customer revenue concentration', 'critical_at_or_above', 35, '%'),

  -- Execution
  ('execution', 'delivery_lead_time_for_changes_days', 'Delivery lead time for changes', 'top_percentile_under_days', 1, 'days'),
  ('execution', 'delivery_lead_time_for_changes_days', 'Delivery lead time for changes', 'high_percentile_under_days', 7, 'days'),
  ('execution', 'pr_cycle_time_hours', 'PR cycle time', 'elite_below', 25, 'hours'),
  ('execution', 'pr_cycle_time_hours', 'PR cycle time', 'good_range_min', 25, 'hours'),
  ('execution', 'pr_cycle_time_hours', 'PR cycle time', 'good_range_max', 72, 'hours'),
  ('execution', 'pr_cycle_time_hours', 'PR cycle time', 'fair_range_min', 73, 'hours'),
  ('execution', 'pr_cycle_time_hours', 'PR cycle time', 'fair_range_max', 161, 'hours'),
  ('execution', 'pr_cycle_time_hours', 'PR cycle time', 'poor_above', 161, 'hours'),
  ('execution', 'pr_review_pickup_time_hours', 'PR review pickup time', 'elite_below', 7, 'hours'),
  ('execution', 'pr_review_pickup_time_hours', 'PR review pickup time', 'industry_average_hours', 105.6, 'hours'),
  ('execution', 'decision_approval_latency_hours', 'Decision/approval latency', 'warning_at_hours', 48, 'hours'),
  ('execution', 'decision_approval_latency_hours', 'Decision/approval latency', 'crisis_at_hours', 168, 'hours'),
  ('execution', 'meeting_load_hours_per_week', 'Weekly meeting hours', 'company_wide_average_min', 11, 'hours/week'),
  ('execution', 'meeting_load_hours_per_week', 'Weekly meeting hours', 'company_wide_average_max', 12, 'hours/week'),
  ('execution', 'meeting_load_hours_per_week', 'Weekly meeting hours', 'individual_contributor_average', 4, 'hours/week'),
  ('execution', 'meeting_load_hours_per_week', 'Weekly meeting hours', 'manager_range_min', 9, 'hours/week'),
  ('execution', 'meeting_load_hours_per_week', 'Weekly meeting hours', 'manager_range_max', 13, 'hours/week'),
  ('execution', 'meeting_load_hours_per_week', 'Weekly meeting hours', 'c_suite_average', 11, 'hours/week'),

  -- Product
  ('product', 'annual_logo_churn_percent', 'Annual logo churn', 'healthy_below', 5, '%'),
  ('product', 'annual_logo_churn_percent', 'Annual logo churn', 'watch_below', 10, '%'),
  ('product', 'annual_logo_churn_percent', 'Annual logo churn', 'concerning_below', 20, '%'),
  ('product', 'nps_score', 'NPS', 'concerning_below', 0, 'score'),
  ('product', 'nps_score', 'NPS', 'average_below', 30, 'score'),
  ('product', 'nps_score', 'NPS', 'good_below', 40, 'score'),
  ('product', 'nps_score', 'NPS', 'excellent_at_or_above', 55, 'score'),
  ('product', 'core_feature_adoption_percent', 'Core feature adoption', 'concerning_below', 10, '%'),
  ('product', 'core_feature_adoption_percent', 'Core feature adoption', 'below_median_below', 16.5, '%'),
  ('product', 'core_feature_adoption_percent', 'Core feature adoption', 'above_average_at_or_above', 24.5, '%'),
  ('product', 'core_feature_adoption_percent', 'Core feature adoption', 'top_quartile_at_or_above', 45, '%'),
  ('product', 'activation_rate_percent', 'Activation rate', 'concerning_below', 15, '%'),
  ('product', 'activation_rate_percent', 'Activation rate', 'below_average_below', 37, '%'),
  ('product', 'activation_rate_percent', 'Activation rate', 'good_at_or_above', 45, '%'),
  ('product', 'activation_rate_percent', 'Activation rate', 'excellent_at_or_above', 55, '%'),
  ('product', 'support_csat_percent', 'Support CSAT', 'concerning_below', 70, '%'),
  ('product', 'support_csat_percent', 'Support CSAT', 'average_below', 77, '%'),
  ('product', 'support_csat_percent', 'Support CSAT', 'good_at_or_above', 85, '%'),

  -- AI & Governance overall maturity tier boundaries (total score, 0-21 with 7 dimensions)
  ('ai_governance', 'overall_maturity_total_score', 'Overall maturity total score', 'nascent_max', 6, 'score'),
  ('ai_governance', 'overall_maturity_total_score', 'Overall maturity total score', 'developing_max', 13, 'score'),
  ('ai_governance', 'overall_maturity_total_score', 'Overall maturity total score', 'established_max', 18, 'score');

insert into governance_dimensions (dimension_key, label, source, sort_order, level_0, level_1, level_2, level_3) values
(
  'ai_use_inventory',
  'AI use inventory',
  'NIST AI RMF (Map function); ISO/IEC 42001 (context/scope, Clause 4)',
  0,
  'No inventory — unsure what AI is used across the business',
  'Informal awareness only (leadership knows roughly, nothing documented)',
  'Partial documented inventory (some tools/uses listed, not comprehensive)',
  'Complete documented inventory, maintained and reviewed periodically'
),
(
  'risk_classification_awareness',
  'Risk classification awareness',
  'EU AI Act 4-tier risk classification; NIST AI RMF (Measure function)',
  1,
  'No risk assessment of any AI use',
  'Awareness that risk varies by use case, but no structured assessment',
  'Informal risk assessment for some/most AI uses',
  'Formal risk classification against a recognized framework (e.g. EU AI Act tiers) for all AI uses'
),
(
  'human_oversight',
  'Human oversight',
  'EU AI Act Art. 14 (human oversight for high-risk systems); NIST AI RMF (Manage function)',
  2,
  'No human review of AI-generated outputs',
  'Ad hoc/inconsistent review',
  'Human review required for some AI uses/outputs',
  'Documented human-in-the-loop process required for all consequential AI outputs'
),
(
  'data_governance_for_ai',
  'Data governance for AI',
  'ISO/IEC 42001 data management provisions — the AI-specific angle only, not full GDPR compliance (that''s the separate Data Protection Compliance module''s job)',
  3,
  'No visibility into what data feeds AI tools',
  'Some awareness, not documented',
  'Documented for some AI tools/uses',
  'Documented and reviewed for all AI tools/uses'
),
(
  'vendor_model_risk_management',
  'Vendor/model risk management',
  'NIST AI RMF (third-party risk); ISO/IEC 42001 (supplier oversight)',
  4,
  'No vendor risk review of any third-party AI tool/API used',
  'Informal awareness only',
  'Reviewed for some vendors/tools',
  'Documented vendor risk review process for all AI vendors'
),
(
  'incident_response_monitoring',
  'Incident response & monitoring',
  'NIST AI RMF (Manage function); ISO/IEC 42001 (performance evaluation, Clause 9)',
  5,
  'No monitoring or incident response process for AI failures',
  'Informal only ("we''d notice and fix it")',
  'Some monitoring/process in place for some AI uses',
  'Documented monitoring + incident response process'
),
(
  'governance_ownership',
  'Governance ownership',
  'ISO/IEC 42001 (leadership/roles, Clause 5); OECD AI Principles (accountability)',
  6,
  'No one specifically responsible for AI governance',
  'Informally someone''s job (e.g. "the CTO handles it"), not formalized',
  'Named owner, not formalized in writing',
  'Formally assigned AI governance responsibility with documented scope'
);
