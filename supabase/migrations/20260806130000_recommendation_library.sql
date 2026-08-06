-- Recommendation library (confirmed 2026-08-06) — second item migrated in
-- the hardcoded-values audit, after the lens benchmarks. Flat one-row-per-
-- entry shape (unlike lens_benchmarks' per-boundary rows), since each
-- library entry is naturally a single unit — key, label, lens, keyword
-- list, template, rationale — with no internal sub-boundaries.
--
-- Same "admin-adjustable, not a constant" principle as lens_benchmarks/
-- governance_dimensions/pricing. Curated, hand-written reference content —
-- migrating it to the DB doesn't change that; it's still never
-- LLM-generated, just editable without a code deploy from here on.
create table recommendation_library (
  issue_type_key text primary key,   -- matches IssueTypeKey, a fixed TS union (structural identity)
  label text not null,
  lens text not null,                -- LensType — 'financial' | 'execution' | 'product' | 'commercial' | 'ai_governance'
  keywords text[] not null,          -- lowercase keywords/phrases checked against a finding's title + diagnosis
  recommended_action_template text not null,
  rationale text not null,
  updated_at timestamptz not null default now()
);

-- Seed data: the exact 16 entries already documented in
-- DEFAULT_RECOMMENDATION_LIBRARY (src/lib/recommendations/recommendation-library.ts),
-- which remains the fallback + source of truth for what was seeded.
insert into recommendation_library (issue_type_key, label, lens, keywords, recommended_action_template, rationale) values
(
  'no_financial_visibility',
  'No real-time/near-real-time financial visibility',
  'financial',
  array['financial visibility', 'no visibility into', 'don''t track', 'don''t have visibility', 'manual spreadsheet'],
  'Stand up monthly (ideally weekly) cash flow and gross-margin reporting from the existing accounting system, owned by a named person, reviewed on a fixed cadence — start with the 3-5 numbers that actually drive decisions rather than a full BI build.',
  'The single most common root blocker behind every other financial finding this lens sees — you can''t manage what you can''t see.'
),
(
  'customer_concentration',
  'High revenue concentration in a small number of customers',
  'financial',
  array['concentration', 'concentrated in', 'top customer', 'largest customer'],
  'Map renewal dates and contract terms for the top 3-5 accounts by revenue; build a named-account retention plan for each, and set an explicit new-logo target sized to reduce concentration below a stated threshold within a defined timeframe.',
  'Concentration risk is a real, common driver of churn/retention goal exposure, not just a financial-lens curiosity.'
),
(
  'thin_margin',
  'Gross margin below benchmark for stage/model',
  'financial',
  array['margin below', 'margin is below', 'thin margin', 'margin compression', 'margin erosion', 'eroding margin'],
  'Break down cost of goods/delivery by line item against the specific benchmark gap identified; target the single largest contributor first rather than an across-the-board cost-cutting exercise.',
  'A generic "cut costs" recommendation is rarely actionable — anchoring to the specific gap keeps this concrete.'
),
(
  'short_runway',
  'Runway below the client''s own risk threshold',
  'financial',
  array['runway', 'burn rate', 'months of runway'],
  'Build a 13-week rolling cash forecast (not just a monthly view) and identify the top 2-3 levers (spend cuts, collections timing, financing options) with a decision deadline tied to the actual runway number, not a vague "soon."',
  'Runway findings need a forecast cadence tighter than monthly reporting can provide — weekly precision matters when the number is small.'
),
(
  'decision_latency',
  'Slow decision/approval chains',
  'execution',
  array['approval chain', 'decision latency', 'approval delay', 'decisions get stuck', 'waiting for approval'],
  'Delegate a defined class of decisions below a stated dollar/impact threshold to the person closest to the work, with an explicit escalation path only for exceptions above that threshold — set a target turnaround SLA and track it.',
  'Blanket "speed up decisions" advice rarely sticks; a concrete delegation threshold does.'
),
(
  'meeting_overload',
  'Excessive meeting load eating into execution time',
  'execution',
  array['meeting load', 'meeting overload', 'too many meetings', 'meetings eating'],
  'Run a two-week meeting audit (who, why, could this be async) across the leadership team specifically, then cut or convert to async anything without a decision or genuine cross-functional need — protect at least one full no-meeting block per day.',
  'Leadership meeting load compounds fastest and has the clearest labor-hours cost to quantify.'
),
(
  'no_operating_reporting',
  'No operating-maturity reporting infrastructure (financial, delivery, or otherwise)',
  'execution',
  array['no crm', 'no reporting', 'no dashboard', 'operating maturity', 'no visibility into'],
  'Pick the single highest-value operating metric currently invisible (often financial, sometimes delivery or pipeline) and stand up the minimum reporting needed to see it weekly — resist building a full system before proving the habit sticks.',
  'This is Execution''s own territory even when the missing visibility is financial/commercial in nature — the process gap, not the numbers themselves.'
),
(
  'low_feature_adoption',
  'Core feature adoption below benchmark',
  'product',
  array['low adoption', 'low core feature adoption', 'adoption is well below', 'adoption well below'],
  'Instrument the specific drop-off point in the activation flow (not just top-line adoption %), then redesign onboarding around getting a new user to first real value within one session — don''t add features before fixing the funnel.',
  'Low adoption is almost always a funnel problem, not a feature-richness problem — the recommendation should point at the funnel.'
),
(
  'high_churn',
  'Churn rate above benchmark',
  'product',
  array['churn', 'churning', 'cancellations'],
  'Stand up a lightweight exit-interview process (even 3 questions) for every cancellation for the next quarter, tagged by reason — most churn-reduction efforts fail because the actual reason was never captured systematically.',
  'You can''t fix churn you can''t categorize — the data-capture step comes before any retention tactic.'
),
(
  'weak_onboarding_activation',
  'Weak onboarding / activation experience',
  'product',
  array['onboarding', 'activation', 'first value', 'time to value'],
  'Map the current path from signup to first meaningful value, identify the single biggest drop-off step, and redesign only that step first — a full onboarding rebuild is rarely the fastest path to improvement.',
  'Scoping to the single worst step keeps this genuinely actionable rather than a multi-quarter project.'
),
(
  'pricing_pressure',
  'Competitive pricing pressure forcing discounting',
  'commercial',
  array['pricing pressure', 'undercutting', 'discount', 'forced to discount'],
  'Audit the last 5-10 discounted deals for the actual objection raised (price vs. perceived value vs. missing feature) before changing list price — a pricing change aimed at the wrong root cause won''t move the needle.',
  'Pricing pressure is often a value-communication problem wearing a price-tag disguise; diagnose before repricing.'
),
(
  'weak_differentiation',
  'No clear stated differentiation from named competitors',
  'commercial',
  array['differentiat', 'no clear differentiator', 'better value'],
  'Run a short positioning exercise against the specific competitor(s) actually being lost to — one clear, evidence-backed reason a prospect should choose you, tested in the next 5 sales conversations before rolling out broadly.',
  'Generic "improve positioning" advice doesn''t survive contact with a real sales call; anchoring to a named competitor does.'
),
(
  'recurring_lost_deal_pattern',
  'A recurring, named reason showing up across multiple lost deals',
  'commercial',
  array['lost deal', 'lost to', 'losses to'],
  'Formalize a lightweight win/loss log (reason, competitor, deal size) for the next quarter of deals — most companies at this stage have anecdotal loss reasons, not a real pattern to act on yet.',
  'One or two lost-deal notes aren''t a pattern; the recommendation should build the muscle to find real patterns, not react to anecdotes.'
),
(
  'no_ai_governance_docs',
  'No AI governance documentation despite live/planned AI use',
  'ai_governance',
  array['no governance documentation', 'no ai use inventory', 'no documented', 'governance gap'],
  'Produce a one-page AI use inventory (what AI is used where, on what data, with what human oversight) before adding any further AI-powered functionality — this is the prerequisite most other governance dimensions build on.',
  'Matches the deterministic guaranteed finding this lens already produces for exactly this combination — the recommendation should be the same every time, not reinvented per audit.'
),
(
  'no_human_oversight',
  'AI-generated outputs reach customers/decisions without human review',
  'ai_governance',
  array['no human oversight', 'no human review', 'without review', 'unreviewed'],
  'Add a mandatory human checkpoint before any AI-generated output reaches a customer or feeds a consequential business decision, scoped to start with the highest-risk use case identified — not necessarily every use case at once.',
  'A phased rollout of oversight (highest-risk first) gets adopted; "review everything immediately" usually doesn''t.'
),
(
  'unclear_ai_risk_classification',
  'No risk classification for AI systems in use',
  'ai_governance',
  array['risk classification', 'not classified', 'unclear risk'],
  'Classify each current AI use case against a simple risk tier (informational/assistive vs. decision-affecting vs. high-stakes) as a first pass — this doesn''t need to be a formal EU AI Act conformity exercise yet (that''s Tender Readiness''s job) to be genuinely useful internally.',
  'Distinguishes this lens''s job (governance maturity) from Tender Readiness''s deeper regulatory classification work — the recommendation should stay at the right depth.'
);
