# AI Execution Audit Platform
## Business Requirements Document, System Architecture, Database Schema & Roadmap
*(Working title — platform name TBD before public launch)*

---

## 1. Business Requirements Document (BRD)

### 1.1 Vision
A goal-driven AI Execution Audit platform for founder-led B2B SaaS and tech-enabled SMEs. The client chooses a primary business goal, submits whatever evidence they have, and the system — AI drafting, human validating — diagnoses what's blocking that goal, what it's costing financially, where AI/automation genuinely applies, and what to do in the next 90 days.

This is a **separate company and brand from Elvanis** — different buyer psychology (fear/urgency vs. curiosity/growth), different trigger, different positioning. Shares underlying technical patterns with Elvanis (Next.js/Supabase/Groq, evidence parsing, AI-drafted findings) but must run on **isolated infrastructure** (own Supabase project, own domain eventually, own legal documents).

**Update — relaunch decision:** the concept has converged closely enough with Elvanis's original vision that this will relaunch *under the same brand and domain* (app.elvanis.com), not as a separate company. Old Elvanis code and database stay untouched as a safe reference/rollback — no deletion, no reuse. The new platform is built on genuinely fresh infrastructure (new GitHub repo, new Supabase project, new Vercel project). During build and pilot, it's deployed on Vercel's free auto-generated URL, with no domain cost yet. At real launch, `app.elvanis.com`'s DNS is pointed from the old Vercel project to the new one. Since there are no real existing users on the old Elvanis app, this cutover has no user-notification complexity — it's a straightforward DNS repoint, ideally done at a planned moment with a rollback path, and with email sending (`RESEND_FROM_EMAIL`) verified on the new project *before* cutover, not discovered broken after.

### 1.2 Problem Statement
Founder-led SMEs cannot identify which problems are truly blocking their chosen business goal, what those problems are costing them financially, or where AI/process changes should be applied first. This leads to scattered initiatives, wasted budget, and AI adoption without measurable ROI. Validated across UK (expertise/cost/ROI barriers), Netherlands/Europe (skills and execution gaps), and Gulf (AI adoption without scaling).

### 1.3 Solution Summary
Goal selection → evidence intake (native tool exports or fill-in templates, no live integrations required) → AI drafts findings across five lenses (Financial, Commercial/Market, Execution/Operating, Product/Customer, AI & Governance), weighted by the chosen goal → human reviewer validates, rejects noise, finalizes top 3 priorities → client receives a financially-quantified 90-day roadmap, including an AI Opportunity section gated by a readiness check.

### 1.4 Target Market / ICP
- **Geography sequencing:** UK first → Netherlands/wider Europe second → Gulf third (gated on UK/NL proof)
- **Vertical (v1):** B2B SaaS and tech-enabled services
- **Company size:** 20–200 employees
- **Buyer:** Founder or CEO-led leadership
- **Trigger state:** already using some digital tools, experiencing growth inefficiency, churn, margin pressure, or execution drag

### 1.5 Business Model & Pricing (initial, to be tested with real pilots)
| Offer | Sequencing | Indicative price |
|---|---|---|
| Core Audit | Standalone default entry | Free/near-free for pilots → later ~£100–300 |
| Execution Sprint | Usually post-audit | ~£2,000–5,000 fixed (founding-client pricing) |
| Tender Readiness | Post-audit by default; standalone if externally triggered | ~£1,500–3,500 |
| AI Reliability Audit | Post-audit by default; standalone if triggered | ~£1,200–3,000 |
| Data Protection Compliance (GDPR now, PDPL for Gulf) | Post-audit by default; standalone if triggered | ~£1,500–3,500 |
| Monthly Execution Office | Recurring, V3, once repeat clients exist | TBD after repeat demand appears |

### 1.6 Success Metrics
- **V1:** clients say top 3 priorities are credible; financial framing feels useful, not fabricated; at least 1–2 findings per client are immediately actionable; some pilots convert to paid Execution Sprint or Tender Readiness
- **V2:** reviewer time per audit measurably decreases; clients reuse the dashboard; repeat/re-audit demand appears; retrieval starts drawing on real case history
- **V3:** recurring revenue exceeds one-off audits; at least one module (AI Reliability Audit or Monthly Execution Office) sells standalone or recurring

### 1.7 Explicitly Out of Scope for V1
- Live *connected* tool integrations (OAuth/API connections) — evidence intake is native export upload or fill-in template, both fully in scope for v1
- Case-library retrieval (library is *recorded* in v1; *retrieval* activates v2)
- Deep competitor/market-intelligence automation
- Multi-vertical support (B2B SaaS only)
- Self-serve without human review

**Correction note 1:** CRM/finance/support/backlog import templates are fully in scope for V1 as part of the per-lens evidence intake (native export upload + fill-in template, per lens) — not a separate V2 item. An earlier draft of this document duplicated this work under V2; that duplication has been removed.

**Correction note 2:** Tender Readiness and AI Reliability Audit both move fully into V1 (research/framework now, build right after the core engine exists). Reasoning: unlike the core audit's bottleneck diagnosis, both modules draw on externally researchable material — AI Act risk-classification criteria and real procurement questionnaires for Tender Readiness; documented real-world AI failure patterns (Air Canada's invented policy, Cursor's fabricated device limit, the 600+ legally sanctioned hallucinated citations) and known adversarial-testing categories (invented policy, data leakage, bias, prompt injection) for AI Reliability Audit. Neither needs a live client to avoid being generic. Both are sequenced *after* the core engine (not before, not in parallel) because they reuse the same evidence intake, reviewer workspace, and report generator — building either before that shared engine exists would mean duplicating work later.

### 1.8 Privacy & Data Handling (core requirement, not an afterthought)
This is elevated to a first-class requirement because the Elvanis founder feedback specifically flagged unclear data-processing language as a trust gap on a near-identical product — repeating that mistake here is avoidable.
- A short, plain-English statement shown **at the point of upload**, not buried in a footer link (named AI provider, no third-party sharing, no external model training)
- Full privacy policy page (data collected, retention period, named AI provider, storage via Supabase, human-review step disclosed, deletion request process)
- Short ToS (audit is advisory, not a guarantee; Tender Readiness output is not formal legal advice)
- For the pilot phase: a lightweight manual acknowledgment (e.g. one line in the intake email) is sufficient before live pages exist — but it must exist before any real pilot company's data is uploaded, not deferred until "launch"

**Forward-looking note — Saudi PDPL (pre-Gulf-launch requirement, not a V1 task):** Saudi Arabia's Personal Data Protection Law (PDPL), overseen by SDAIA, requires valid consent, published privacy notices, honored data-subject rights (access/correct/delete/port), 72-hour breach notification, and restricted cross-border data transfer — with fines up to 5 million SAR for non-compliance. Since Gulf is sequenced third (after UK/NL proof), this isn't urgent today — but before any real Saudi client's data touches the system, this section needs a Gulf-specific addendum: confirming where evidence is actually stored/processed (Supabase project region, Groq's processing location) satisfies PDPL's cross-border transfer restrictions, and that the 72-hour breach notification requirement (stricter than a GDPR-only posture) is built into incident response, not assumed.

### 1.8a Data Protection & Privacy Compliance Module (new — separate from Tender Readiness)
This is a genuinely distinct module from Tender Readiness, not a duplicate — worth building for a specific reason beyond "the LinkedIn post looked relevant."

**Why it's a separate module, not folded into Tender Readiness:** Tender Readiness covers AI-specific governance (AI use inventory, AI Act risk classification, AI procurement questions). PDPL/GDPR-style data protection is broader and AI-agnostic — it applies to *any* company handling personal data, whether or not they use AI at all. Different regulatory domain, different evidence needed (consent flows, data-subject-request handling, retention policies, breach-response readiness), different buyer trigger (a data protection audit request, not necessarily an AI-specific one).

**Where I'd actually start, and why not PDPL first:** your own market sequencing is UK/NL first, Gulf third — and GDPR (the UK/EU equivalent of PDPL) is already fully in force and highly relevant to your *current* target market, not a future one. So the honest build order is: research and build this module around **GDPR first** (relevant now, to UK/NL clients), and extend it to **PDPL specifically once Gulf entry is real** — reusing the same evidence engine and module structure, just a different regulatory reference set. Building PDPL-first for a market you're not targeting yet would be solving tomorrow's problem before today's.

**Sequencing:** research now (cheap, externally documented — same logic as Tender Readiness and AI Reliability Audit), build alongside or shortly after those two in V1/V2, since it reuses the same intake/reviewer/report infrastructure. Not gated on a live client trigger, for the same reason those two aren't.

### 1.9 Service Layer (human touchpoints alongside the software)
The product is software-first, but several human-delivered moments are part of the actual offer, not incidental to it:
- **Guided onboarding** — helping a client frame their goal and gather better evidence
- **Expert review** — the mandatory human validation step before any report is sent (see §2.3, step 8)
- **Delivery session** — a live call walking through the top 3 bottlenecks, what matters most, and where AI is/isn't worth it yet
- **Implementation scoping** — translating the blueprint into the first Execution Sprint
- **Optional monthly advisory** — review progress, re-rank priorities, refresh roadmap (feeds into the eventual Monthly Execution Office)
This is the "consultation service" layer — it's not a separate product, it's the trust/interpretation layer wrapped around the software.

---

## 2. System Architecture

### 2.1 Principles (from CTO review)
- **Provider abstraction, not hardcoded Groq calls.** Elvanis has already been forced through one full model migration and one reverted migration due to Groq deprecations. All LLM calls must go through a single internal `ai-client` module so the provider/model can change via config, not a multi-file rewrite.
- **Evidence-in, structured-out, everywhere.** Every lens is a discrete AI call with a strict expected output schema, independent of the others, so one lens failing doesn't block the rest.
- **Human review is a first-class workflow step, not an afterthought UI.** Every finding is `draft` → `reviewer_edited` (optional) → `approved` before it can appear in a client-facing report.
- **Source-agnostic evidence.** No live OAuth integrations in v1. Accepts native tool exports (CSV/PDF) or fill-in templates; a single merge-and-complete step reconciles whichever arrived.
- **Fully isolated from Elvanis.** Own Supabase project, own environment variables, own domain (interim: subpath or subdomain off app.elvanis.com; real domain at launch).
- **Mandatory human review gate, not optional.** A report cannot reach `sent` status without passing through `pending_review` → reviewer `approved`. This is enforced at the database/workflow level, not just a UI convention — there is no code path that delivers a report without that gate.
- **Business profile is a living record, not a one-time capture.** Company profile, goal, and evidence are all versioned and re-readable — every lens prompt reads the *current* state of the profile at generation time, not a stale copy taken at signup. If a client updates their goal or profile between audits, the next generation reflects that change automatically.
- **Known-source template library.** Rather than parsing every upload generically, the system maintains a library of recognized export signatures (column headers, file-naming patterns) for common tools (Xero, QuickBooks, HubSpot, Salesforce, Jira, Intercom, Zendesk). A recognized file auto-selects the matching field-mapping template; an unrecognized file falls back to generic parsing + the merge-and-complete page.

### 2.2 Tech Stack
- **Frontend/Backend:** Next.js (App Router), same as Elvanis
- **Database/Auth/Storage:** Supabase — **new, separate project** (not shared tables in Elvanis's instance)
- **AI:** Groq via internal `ai-client` abstraction (model name in config/env, not hardcoded per call site)
- **Email:** Resend (reuse pattern from Elvanis)
- **File parsing:** CSV parser + PDF/text extraction + OCR fallback for screenshots

### 2.3 High-Level Data Flow
0. **Digital Presence Scan (free, optional, pre-signup)** — company name/URL only, no login; pulls public signals (website, socials, reviews, mentions); B2B-vs-B2C-aware scoring baseline (a thin public footprint is a real finding for a B2C brand, often normal for B2B); this is a trust-building/lead-in tool, not a substitute for real evidence
1. **Company Profile & Goal** — client creates profile (auto-populated from public data where available, e.g. company name, industry, size signals), selects primary goal (weighting layer, not a lens); profile is a living record, re-read fresh by every prompt generation, not cached at signup
2. **Evidence Intake** — per lens, client uploads a native export *or* fills a template *or* both; the known-source template library auto-detects recognized tool exports (Xero, HubSpot, Jira, etc.) and applies the right field-mapping automatically; unrecognized files fall back to generic parsing; produces a merge-and-complete page showing populated + blank required fields
3. **Evidence Sufficiency Check** — per lens, evidence is checked against minimum thresholds; insufficient evidence either blocks the lens (with explanation) or is itself logged as a finding (e.g. "no financial visibility" as an Execution-lens finding)
4. **Five-Lens AI Drafting** — parallel AI calls: Financial, Commercial/Market, Execution/Operating, Product/Customer, AI & Governance (governance sub-branches: questionnaire mode if no existing docs, document-review mode if client uploads governance material)
5. **Conflict Detection** — findings across lenses are checked against each other for contradictions (e.g. Financial lens implies healthy margin while Execution lens implies major cost drag) before prioritization; flagged conflicts are surfaced to the reviewer, not silently resolved by the AI
6. **AI Opportunity Synthesis** — separate synthesis pass reading all five lenses' approved findings + a Readiness sub-check (data quality, team skill, process maturity) → tags each opportunity "do now" vs. "fix groundwork first"
7. **Financial Impact Estimator** — produces ranges + confidence + stated assumptions, not false precision
8. **Reviewer Workspace (mandatory gate)** — you accept/reject/edit findings, resolve flagged conflicts, re-rank priorities using "fix this first" logic, adjust financial bands, add context; report cannot move to `sent` status without this approval step
9. **Notifications** — client notified when report is ready; you (reviewer) notified on new submission and on evidence-completeness milestones; email via Resend, same pattern as Elvanis
10. **Report & Client Dashboard** — top 3 bottlenecks, root causes, financial impact, AI opportunity map, 30/60/90 roadmap, next-module CTAs
11. **Case Library Write** — every completed audit stored/tagged (v1: storage only; v2: retrieval activates)
12. **Scheduled Jobs (crons)** — re-audit reminder cadence, evidence-completeness nudges, Execution Sprint progress check-ins, Monthly Execution Office refresh triggers

### 2.4 Module Boundaries
- **Tender Readiness**, **AI Reliability Audit**, and **Data Protection Compliance** are all built on externally researchable material — none require a live client trigger to build a solid v1. Each has its own intake, findings schema, report template, and standalone entry page, built on the shared core engine once it's stable.
- **AI Opportunity** is *not* a module — it has no standalone table beyond being an output section linked to a given audit's synthesis result.

### 2.5 Information Architecture — Four Separate Areas, Not One Page
Recommendation: keep these genuinely separate, not combined into one "profile" page, because they answer different questions and change at different rates.

- **Account Settings** — about the *person* logging in: name, email, password, notification preferences, plan/subscription and billing. Changes rarely, personal, not client-facing content.
- **Business Profile** — about the *company being diagnosed*: brand name, website URL, social/review links, industry, business model, goals (current + history), tools/stack. This is the living record every lens prompt reads from — it changes occasionally, and its accuracy directly affects diagnosis quality.
- **Reports & History** — a chronological archive of everything generated for that company: Digital Presence Scan, each Core Audit report (including re-audits), Tender Readiness output, AI Reliability Audit output. Each report is a frozen snapshot, referencing the profile's state *at that time* — not retroactively altered if the profile changes later. This is also where "comparison over time" (V2) naturally lives.
- **Dashboard** — the current, active view: latest top-3 priorities, roadmap status, active Execution Sprint progress. This is "what matters right now," distinct from the historical archive.

**Why separate, not combined:** cramming brand info, account settings, and a report archive into one page recreates the exact "too broad, hard to navigate" criticism the Elvanis founder feedback raised. Separating by *rate of change and purpose* (rarely-changing personal settings vs. occasionally-changing company facts vs. frozen historical snapshots vs. live current state) is a standard, well-tested B2B SaaS pattern, and it keeps each page answerable in one sentence — the same clarity principle we've applied to positioning all along.

---

## 3. Database Schema (core tables, v1 scope)

```
users
  id, name, email, password_hash, notification_preferences (jsonb),
  plan_tier, created_at, last_login_at

companies
  id, user_id (fk), name, website_url, social_links (jsonb), industry, business_model (B2B/B2C),
  country, employee_count, stage, revenue_range_band, customer_type, main_tools_stack (jsonb),
  team_structure_summary, created_at, updated_at, privacy_acknowledged_at

company_profile_history
  id, company_id (fk), changed_field, old_value, new_value, changed_at
  -- ensures prompts always read current profile state, and changes are auditable

digital_presence_scans
  id, company_url_or_name, industry_hint, business_model_hint (B2B/B2C),
  public_signals (jsonb), presence_score, findings_summary, is_linked_to_company_id (fk, nullable)
  -- free, pre-signup entry point; not evidence, purely a trust-building lead-in

goals
  id, company_id (fk), primary_goal, secondary_goal (nullable),
  urgency_level, target_metric, time_horizon, success_definition

evidence_submissions
  id, company_id (fk), lens (financial/commercial/execution/product/ai_governance),
  source_type (native_export / template_fill / merged), status (pending/complete/insufficient),
  created_at

evidence_files
  id, evidence_submission_id (fk), file_url, file_type, parsed_status,
  parsed_field_map (jsonb)

evidence_fields
  id, evidence_submission_id (fk), field_name, field_value, source (parsed/manual),
  is_required, is_blank

lens_findings
  id, company_id (fk), lens, ai_draft (jsonb), reviewer_status (draft/edited/approved/rejected),
  reviewer_notes, confidence_level (high/medium/low/insufficient),
  is_missing_data_finding (bool), created_at

financial_impact_estimates
  id, lens_finding_id (fk), impact_band_low, impact_band_high, currency,
  confidence_level, assumptions (text[])

ai_governance_detail
  id, company_id (fk), mode (questionnaire/document_review),
  questionnaire_answers (jsonb), uploaded_docs (jsonb)

ai_opportunity_synthesis
  id, company_id (fk), source_finding_ids (fk array), opportunity_description,
  readiness_status (do_now/fix_groundwork_first), readiness_reasoning

readiness_scores
  id, company_id (fk), data_quality, team_skill, process_maturity, governance_foundation

priority_ranking
  id, company_id (fk), lens_finding_id (fk), goal_relevance_score, financial_impact_score,
  urgency_score, confidence_score, rank_order, fix_first_flag (bool)

finding_conflicts
  id, company_id (fk), finding_a_id (fk), finding_b_id (fk), conflict_description,
  resolution_status (unresolved/reviewer_resolved), reviewer_notes

reports
  id, company_id (fk), goal_id (fk), top_3_finding_ids (fk array), roadmap_30_60_90 (jsonb),
  status (draft/pending_review/approved/sent), reviewed_by, delivered_at
  -- status can never reach 'sent' without passing 'approved' — enforced at workflow level

notifications
  id, recipient_type (client/reviewer), recipient_id, event_type (report_ready/new_submission/
  evidence_incomplete/sprint_update), sent_at, channel (email)

execution_sprints
  id, company_id (fk), report_id (fk), selected_finding_id (fk), status (scoped/in_progress/complete),
  start_date, target_end_date

sprint_tasks
  id, execution_sprint_id (fk), task_description, owner, status, kpi_target, kpi_actual, due_date

scheduled_jobs
  -- not a client-facing table; cron definitions: re_audit_reminder, evidence_completeness_nudge,
  -- sprint_progress_checkin, monthly_retainer_refresh

case_library
  id, company_id (fk), report_id (fk), tags (text[]), stored_for_retrieval (bool, false in v1)
  -- retrieval activates in v2

monthly_retainers
  id, company_id (fk), status (active/paused/cancelled), start_date, refresh_cadence,
  last_refresh_report_id (fk), price
  -- v3: built once repeat demand appears

export_source_signatures
  id, source_name (Xero/HubSpot/Jira/Intercom/etc.), signature_pattern (jsonb),
  field_mapping_template (jsonb)
  -- known-source template library: recognized files auto-map; unrecognized fall back to generic parse

tender_readiness_requests
  id, company_id (fk), status, ai_use_inventory (jsonb), risk_classification (jsonb),
  missing_documentation (jsonb), procurement_answer_drafts (jsonb), evidence_pack_url, created_at

ai_reliability_requests
  id, company_id (fk), status, ai_workflow_inventory (jsonb), adversarial_test_results (jsonb),
  failure_mode_findings (jsonb), remediation_recommendations (jsonb), created_at

data_protection_requests
  id, company_id (fk), status, regulatory_reference (GDPR/PDPL), consent_flow_review (jsonb),
  data_subject_rights_readiness (jsonb), retention_policy_review (jsonb),
  breach_response_readiness (jsonb), cross_border_transfer_check (jsonb), created_at

-- Standard:
sessions, orders/pricing (added once pricing/payment is wired)
```

---

## 4. Roadmap

| Phase | Version | Duration | Goal |
|---|---|---|---|
| **0 — Thesis & scope** | V1 | 1–2 wks | Lock ICP, 1 headline goal + full goal menu, evidence taxonomy, report structure, privacy/consent approach drafted |
| **1 — Diagnostic framework + Tender Readiness research** | V1 | 2 wks | Write all five lens prompts (equal depth), reference benchmarks from own experience, draft report template, readiness/synthesis logic design; **in parallel:** research AI Act risk-classification criteria, real procurement questionnaires, and competitor report structures (Verumt, Flutteris, Legalithm) to design the Tender Readiness checklist/question set/report template; draft privacy statement + ToS |
| **2 — MVP build + Tender Readiness + AI Reliability Audit build** | V1 | 5–6 wks | Goal selector, dual-path evidence intake per lens (native export upload — CRM/finance/support/backlog, known-source template library — plus fill-in templates) + merge-and-complete page, five-lens AI drafting, reviewer workspace (mandatory approval gate), client report page, notifications, crons, case-library storage (no retrieval yet); **once the core engine is stable:** build Tender Readiness and AI Reliability Audit on top of it (each with own intake, findings schema, report, standalone entry page) |
| **3 — Pilot** | V1 | 4–6 wks | 3–5 real/warm-network companies; manual prompt refinement; populate real case library; instrument reviewer time per audit; Tender Readiness and AI Reliability Audit both available with a live trigger; privacy/ToS acknowledgement live |
| **4 — Productized hybrid platform** | V2 | See detail below | Self-serve workflow improvements, deeper lens analysis, case-library retrieval, richer client dashboard features, packaging polish |
| **5 — Modular execution intelligence platform** | V3 | See detail below | Monthly Execution Office, better benchmarking, multi-pack expansion, stronger commercial system |

---

## 4a. V2 Feature Detail — Productized Hybrid Platform
*(Objective: turn the expert-assisted V1 audit into a more scalable guided software product, once 5–10 real audits exist and patterns start repeating. On review, several items below are actually core enough to build in V1 already — marked accordingly rather than left ambiguous.)*

**1. Stronger client self-serve workflow**
- Multi-step guided workflow *(→ moved to V1 — this is just onboarding UX, no dependency on real case history)*
- Cleaner onboarding polish — V2
- Saved draft intake — V2
- Teammate invite for evidence completion — V2
- Goal definition wizard — V2
- Reusable templates by company type — V2 (needs multiple company types actually seen)

**2. Better analysis depth**
- Deeper Product/Customer lens — V2
- Deeper AI & Governance lens — V2
- Better Commercial/Market lens — V2
- Benchmark rule library — V2 (grows with real cases)
- Failure-mode library by goal — V2 (grows with real cases)
- Recommendation library by issue type *(→ seed version moved to V1, hand-built from your own domain expertise, same logic as Tender Readiness's external research; richer version stays V2, grown from real case volume)*

**3. Case library and retrieval**
- Structured case tagging — **V1** (storage happens from day one; see §3 DB schema)
- Retrieval of similar past audits — V2 (genuinely needs real case history to be meaningful)
- "Similar patterns seen in X company types" surfacing — V2
- Internal similarity suggestions before draft generation — V2

**4. Better client dashboard**
- Findings by lens, Priority status, Roadmap sections, Assumption/confidence visibility, Conflict flags surfaced *(→ all moved to V1 — these are just report/dashboard output with no data-history dependency; already in the V1 Feature→Task list)*
- Digital Presence Scan results linked in *(→ moved to V1 — the scan itself has no history dependency)*
- Re-run/refresh button — V2 (needs retrieval to add real value beyond a plain re-run)
- Comparison over time — V2 (genuinely needs ≥2 real audits per company to exist)

**5. Packaging features**
- Implementation Sprint handoff page / Execution Sprint dashboard (task breakdown, owner mapping, KPI tracking) *(→ moved to V1 — needed to actually deliver the paid Execution Sprint, a real revenue offer)*
- Proposal/scope generator — V2
- Recommended next-module selector — V2
- Recurring re-audit prompt — V2

**6. Light data connectors**
*(Note: per-lens native export upload — CRM/finance/support/backlog — and fill-in templates are already confirmed in V1; this stage is about deepening that, not introducing it.)*
- Improved auto-detection of known source signatures — V2
- Broader tool coverage — V2

---

## 4b. V3 Feature Detail — Modular Execution Intelligence Platform
*(Objective: evolve from an audit product into a modular, recurring system, once the core audit is selling reliably and enough cases exist to justify the modules. AI Reliability Audit has been moved into V1 alongside Tender Readiness — see §1.7 correction note 2 — so it's no longer listed here.)*

**1. Monthly Execution Office layer**
- Scheduled re-audit
- Roadmap refresh
- Monthly executive summary
- Issue re-prioritization
- Goal progress review
- New AI opportunity detection
- Governance refresh reminders

**2. Better benchmarking**
- Goal-specific benchmark ranges
- Issue frequency benchmarks
- Recommendation performance patterns
- Cross-case learning summaries

**3. Multi-pack expansion**
- Professional services pack
- Training/education pack
- EU-facing tender pack
- Later: GCC transformation/adoption pack

**4. Stronger commercial system**
- Standalone module sales pages
- Recurring plan management
- Partner/advisor workflow, if needed

---

## 5. Feature → Task Breakdown

**Goal & Context Layer**
- [ ] Goal selector (headline: 1 promise; full menu: all goals)
- [ ] Company profile form (industry, size, country, business model B2B/B2C)
- [ ] Urgency + current top concern input

**Public Digital Presence Scan (free entry)**
- [ ] Company name/URL input, no login
- [ ] Public signal scraping (website, socials, reviews, mentions)
- [ ] B2B vs. B2C aware scoring baseline (what counts as "insufficient" differs by type)
- [ ] Link scan result to a real company profile if they continue past the free scan

**Business Profile (living record) — full field set**
- [ ] Core identity: name, industry, business model (B2B/B2C), country, employee count, stage/maturity
- [ ] Brand identity: website URL, social/review links
- [ ] Business context: revenue range band, customer type, main tools/stack in use, team structure summary
- [ ] Auto-populate from public data (name, industry, size signals) where available
- [ ] Profile edit history (company_profile_history table)
- [ ] All lens prompts read current profile state at generation time, not a cached copy
- [ ] Own dedicated page, separate from account settings and reports

**Account Settings (separate page — personal, not business)**
- [ ] Name, email, password management
- [ ] Notification preferences
- [ ] Plan/subscription and billing

**Reports & History (separate page — chronological archive)**
- [ ] List of all generated reports: Digital Presence Scan, each Core Audit (incl. re-audits), Tender Readiness, AI Reliability Audit
- [ ] Each report references the Business Profile's state at generation time (frozen snapshot, not retroactively altered)
- [ ] Comparison-over-time view (V2, once ≥2 real audits exist for a company)

**Dashboard (separate page — current, live state)**
- [ ] Latest top-3 priorities
- [ ] Active roadmap status
- [ ] Active Execution Sprint progress

**Evidence Intake**
- [ ] Per-lens native export upload (CSV/PDF) with field auto-mapping (reuse/extend Elvanis Anchor Column logic)
- [ ] Known-source template library: recognize common exports (Xero, QuickBooks, HubSpot, Salesforce, Jira, Intercom, Zendesk) by signature, auto-apply correct mapping
- [ ] Generic parsing fallback for unrecognized files
- [ ] Per-lens fill-in template as fallback
- [ ] Merge-and-complete page: pre-filled + blank required fields, single view
- [ ] Evidence sufficiency check per lens (block, or log as finding, per lens rules)

**Five-Lens Analysis Engine**
- [ ] Financial lens prompt + schema
- [ ] Commercial/Market lens prompt + schema
- [ ] Execution/Operating lens prompt + schema
- [ ] Product/Customer lens prompt + schema
- [ ] AI & Governance lens — questionnaire mode + document-review mode branch

**Conflict Detection**
- [ ] Cross-lens contradiction check (e.g. Financial vs. Execution implying different things)
- [ ] Conflict flagged to reviewer, not auto-resolved
- [ ] Reviewer resolution UI

**AI Opportunity & Readiness**
- [ ] Synthesis pass across all five lenses' approved findings
- [ ] Readiness sub-check (data/team/process/governance)
- [ ] "Do now / fix groundwork first" tagging logic

**Financial Impact Engine**
- [ ] Impact band estimator (low–high, never single fake-precise number)
- [ ] Confidence level + stated assumptions output

**Reviewer Workspace (mandatory gate)**
- [ ] View drafts by lens
- [ ] Accept/reject/edit per finding
- [ ] Resolve flagged conflicts
- [ ] Re-rank priorities with "fix this first" logic
- [ ] Approve final report — enforced gate: no `sent` status without this step
- [ ] Time-per-audit instrumentation (for scaling proof)

**Client Output & Dashboard**
- [ ] Report generator (top 3, root cause, financial impact, AI opportunity, 30/60/90)
- [ ] Goal tracker
- [ ] Findings-by-lens view with status
- [ ] Roadmap section (30/60/90, editable status)
- [ ] Assumption/confidence visibility per finding
- [ ] Evidence library (what was submitted, re-upload option)
- [ ] Re-run/refresh button (v2, once retrieval exists)
- [ ] Next-step CTAs (Execution Sprint / Tender Readiness / AI Reliability)

**Monthly Execution Office (V3 — built once repeat demand appears)**
- [ ] Recurring re-audit trigger/subscription record
- [ ] Refresh cadence + cron trigger
- [ ] Monthly executive summary generation (reuses report generator)
- [ ] Issue re-prioritization on refresh

**Execution Sprint Dashboard**
- [ ] Sprint scoping from a selected finding
- [ ] Task breakdown with owner mapping
- [ ] KPI target vs. actual tracking
- [ ] Progress status (scoped/in progress/complete)
- [ ] Sprint timeline / due dates

**Notifications**
- [ ] Client: report ready
- [ ] Reviewer: new submission received
- [ ] Reviewer: evidence-completeness milestone reached
- [ ] Client: sprint progress update
- [ ] Delivery via Resend, same pattern as Elvanis

**Scheduled Jobs (crons)**
- [ ] Re-audit reminder cadence
- [ ] Evidence-completeness nudge
- [ ] Sprint progress check-in reminder
- [ ] (v3) Monthly Execution Office refresh trigger

**Privacy & Consent**
- [ ] Upload-moment micro-copy (named AI provider, no external training, no sharing)
- [ ] Full privacy policy page (adapted from Elvanis's structure)
- [ ] Short ToS (advisory disclaimer; Tender Readiness not formal legal advice)
- [ ] Pilot-stage lightweight acknowledgment (before live pages exist)
- [ ] `privacy_acknowledged_at` captured per company before first real evidence upload

**Service Layer (human touchpoints)**
- [ ] Guided onboarding flow/script
- [ ] Delivery session template (live call structure)
- [ ] Implementation scoping handoff into Execution Sprint
- [ ] Optional monthly advisory touchpoint (feeds Monthly Execution Office later)

**Tender Readiness Module (built in V1, after core engine is stable)**
- [ ] Research: EU AI Act risk-classification criteria, real procurement questionnaires, competitor report structures (Verumt, Flutteris, Legalithm)
- [ ] Design checklist/question set/report template from that research
- [ ] AI use-case inventory intake
- [ ] Risk classification logic
- [ ] Missing-documentation gap finder
- [ ] Draft procurement-answer generator
- [ ] Evidence pack builder/export
- [ ] Standalone entry page (sellable independent of core audit)

**Infrastructure**
- [ ] New, isolated Supabase project
- [ ] `ai-client` provider-abstraction module
- [ ] Case library storage schema (retrieval logic deferred to v2)

**AI Reliability Audit Module (built in V1, after core engine is stable — same treatment as Tender Readiness)**
- [ ] Research: documented real-world AI failure patterns (Air Canada, Cursor, legal-citation hallucination cases) and known adversarial-testing categories (invented policy, data leakage, bias, prompt injection)
- [ ] Design test-case framework from that research
- [ ] AI workflow inventory intake
- [ ] Adversarial test execution against a client's live AI feature
- [ ] Failure-mode/escalation review
- [ ] Reliability risk summary + remediation recommendations
- [ ] Standalone entry page (sellable independent of core audit)

**Data Protection Compliance Module (new — GDPR first, since it's relevant to current UK/NL market; PDPL extension built when Gulf entry is real)**
- [ ] Research: GDPR requirements (consent, data-subject rights, retention, breach notification, cross-border transfer)
- [ ] Design checklist/report template from that research
- [ ] Consent-flow review intake
- [ ] Data-subject-rights readiness check (access/correct/delete/port)
- [ ] Retention policy review
- [ ] Breach-response readiness check
- [ ] Cross-border transfer check
- [ ] Standalone entry page (sellable independent of core audit)
- [ ] Later, when Gulf entry is real: extend with Saudi PDPL-specific reference set (SDAIA guidelines, 72-hour breach notification, PDPL cross-border restrictions)
