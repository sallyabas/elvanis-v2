-- Signal cascades (confirmed 2026-08-13, item 1 of the old-Elvanis-inspired
-- batch, ported from the old Elvanis app's SIGNAL_CASCADES concept — see
-- CLAUDE.md) — adds a curated, hand-authored "which other issue types does
-- this one predictably drive downstream" map to the existing
-- recommendation_library table, reusing its 16 curated issue types as the
-- cascade vocabulary rather than inventing a new, separate taxonomy.
--
-- Never editing the already-applied 20260806130000 migration in place —
-- consistent with this codebase's standing rule that an applied migration
-- is immutable and any follow-up needs its own file.
alter table recommendation_library add column cascades_to text[] not null default '{}';

update recommendation_library set cascades_to = array['thin_margin', 'short_runway', 'customer_concentration', 'no_operating_reporting'] where issue_type_key = 'no_financial_visibility';
update recommendation_library set cascades_to = array['short_runway'] where issue_type_key = 'customer_concentration';
update recommendation_library set cascades_to = array['short_runway'] where issue_type_key = 'thin_margin';
update recommendation_library set cascades_to = array[]::text[] where issue_type_key = 'short_runway';
update recommendation_library set cascades_to = array['meeting_overload', 'weak_onboarding_activation', 'low_feature_adoption'] where issue_type_key = 'decision_latency';
update recommendation_library set cascades_to = array['decision_latency'] where issue_type_key = 'meeting_overload';
update recommendation_library set cascades_to = array['decision_latency', 'no_financial_visibility'] where issue_type_key = 'no_operating_reporting';
update recommendation_library set cascades_to = array['high_churn'] where issue_type_key = 'low_feature_adoption';
update recommendation_library set cascades_to = array['short_runway', 'customer_concentration'] where issue_type_key = 'high_churn';
update recommendation_library set cascades_to = array['low_feature_adoption', 'high_churn'] where issue_type_key = 'weak_onboarding_activation';
update recommendation_library set cascades_to = array['thin_margin'] where issue_type_key = 'pricing_pressure';
update recommendation_library set cascades_to = array['pricing_pressure', 'recurring_lost_deal_pattern'] where issue_type_key = 'weak_differentiation';
update recommendation_library set cascades_to = array[]::text[] where issue_type_key = 'recurring_lost_deal_pattern';
update recommendation_library set cascades_to = array['unclear_ai_risk_classification', 'no_human_oversight'] where issue_type_key = 'no_ai_governance_docs';
update recommendation_library set cascades_to = array[]::text[] where issue_type_key = 'no_human_oversight';
update recommendation_library set cascades_to = array['no_human_oversight'] where issue_type_key = 'unclear_ai_risk_classification';
