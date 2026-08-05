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

**Core Audit has two service tiers, confirmed 2026-08-02 — same technical pipeline (five-lens engine, Conflict Detection, mandatory review; no new pipeline for Concierge), different level of human attention.** See §1.9 for the full breakdown of what each tier includes.

| Offer | Tier | Sequencing | Indicative price |
|---|---|---|---|
| Core Audit — Standard | Standard | Standalone default entry | Free/near-free for pilots → later ~£100–300 |
| Core Audit — Concierge/White-Glove | Concierge | Standalone, premium alternative to Standard | TBD — premium multiplier over Standard, to be tested with pilots |
| Execution Sprint | — | Usually post-audit | ~£2,000–5,000 fixed (founding-client pricing) |
| Tender Readiness | — | Post-audit by default; standalone if externally triggered | ~£1,500–3,500 |
| AI Reliability Audit | — | Post-audit by default; standalone if triggered | ~£1,200–3,000 |
| Data Protection Compliance (GDPR now, PDPL for Gulf) | — | Post-audit by default; standalone if triggered | ~£1,500–3,500 |
| Monthly Execution Office | — | Recurring, V3, once repeat clients exist | TBD after repeat demand appears |

**Service Layer add-ons (confirmed 2026-08-02)** — see §1.9 for the full sequencing rules (what's included by default per tier vs. sellable standalone):

| Add-on | Included by default in | Standalone availability | Notes |
|---|---|---|---|
| Discovery Session (live call, pre-evidence) | Concierge tier | Optional add-on on Standard tier, offered but never required | A client can skip straight to uploading evidence with zero human interaction on either tier |
| Delivery Session (live call, post-report) | Concierge tier; bundled by default with paid Execution Sprint | Sellable standalone as a smaller add-on | Not included in the free/Standard tier's report+dashboard — that tier is written report + dashboard only |
| F2F Workshop (in-person, multi-stakeholder) | Concierge tier, as a further upgrade | Sellable standalone as a premium upgrade of the Delivery Session | Only offered after evidence submission/findings exist — needs real findings to discuss, never offered before |

Exact standalone prices for Delivery Session and F2F Workshop are intentionally left TBD here rather than guessed — same "test with real pilots" posture as the rest of this table, not a gap.

**Free tier definition (confirmed 2026-07-31):** "free" above means the *first completed audit per company*, however long evidence-gathering takes — not a time-boxed trial. Any full re-audit after that first report is delivered is paid (Execution Sprint / re-audit pricing / eventual Monthly Execution Office). See §2.3a for the submission/SLA mechanics this ties into.

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

### 1.7a AI Reliability Audit — Confirmed Design (2026-08-02)
This detail existed only informally before now and is captured here for the first time — the task-breakdown checklist's "adversarial test execution against a client's live AI feature" phrasing is superseded by this: **evidence-based, no live execution, same pattern as every other module and lens in V1.** Consistent with §1.7's "no live connected integrations" rule — this module never calls a client's AI system directly.

**Intake branches on system type, decided by a clarifying question first:** does the client's AI have a conversational interface, or does it run autonomously in the background (an agent/automation with no direct user-facing chat)?

**Conversational (chatbot) path:** the client runs a guided self-test script — specific adversarial prompts we provide, drawn from the documented failure patterns (Air Canada, Cursor, legal-citation hallucinations) and the four researched categories (invented policy, data leakage, bias, prompt injection). The client types these into their own chatbot and pastes back the real responses. No live API access, no integration — pure evidence submission, identical in kind to every other module's evidence intake.

**Agent/automation path (no conversational interface):** ask instead for:
- (a) Execution/trace logs or real incident history — actual past runs, especially anything that went wrong.
- (b) What credentials/permissions the agent operates under, and whether its actions are attributable to it specifically (accountability/traceability).
- (c) Whether any human review/escalation step exists for its consequential actions.

**Deterministic rule, agent/automation path (same "missing evidence is itself the finding" principle already built into Financial and AI & Governance):** if the client cannot produce any trace logs or execution history at all, that absence must itself become a governance finding, guaranteed in code — never left to LLM discretion to remember. A business running an autonomous agent with zero visibility into what it has actually done is a real, flaggable risk on its own, independent of anything else the evidence shows.

### 1.8 Privacy & Data Handling (core requirement, not an afterthought)
This is elevated to a first-class requirement because the Elvanis founder feedback specifically flagged unclear data-processing language as a trust gap on a near-identical product — repeating that mistake here is avoidable.
- A short, plain-English statement shown **at the point of upload**, not buried in a footer link (named AI provider, no third-party sharing, no external model training)
- Full privacy policy page (data collected, retention period, named AI provider, storage via Supabase, human-review step disclosed, deletion request process)
- Short ToS (audit is advisory, not a guarantee; Tender Readiness output is not formal legal advice)
- For the pilot phase: a lightweight manual acknowledgment (e.g. one line in the intake email) is sufficient before live pages exist — but it must exist before any real pilot company's data is uploaded, not deferred until "launch"

**Forward-looking note — Saudi PDPL and this platform's own infrastructure (pre-Gulf-launch requirement, not a V1 task):** Saudi Arabia's Personal Data Protection Law (PDPL), overseen by SDAIA, requires valid consent, published privacy notices, honored data-subject rights (access/correct/delete/port), 72-hour breach notification, and restricted cross-border data transfer — with fines up to 5 million SAR for non-compliance. This note is about *this platform's own* infrastructure compliance (where Elvanis itself stores/processes a real Saudi client's evidence) — genuinely gated on Gulf entry, distinct from the Data Protection Compliance *module's* PDPL assessment content for clients, which is no longer deferred (§1.8d, built 2026-08-03, since PDPL is already actively enforced today regardless of when Elvanis has its first Saudi client). Since Gulf is sequenced third (after UK/NL proof), the infrastructure question isn't urgent today — but before any real Saudi client's data touches the system, this section needs a Gulf-specific addendum confirming where evidence is actually stored/processed (Supabase project region, Groq's processing location) satisfies PDPL's cross-border transfer restrictions, and that the 72-hour breach notification requirement is built into incident response, not assumed. **Correction (§1.8d, 2026-08-03):** PDPL's 72-hour window is not "stricter than a GDPR-only posture" as originally written here — GDPR/UK GDPR also require regulator notification within 72 hours where feasible (Article 33). The two regimes share the same timeframe; the real difference is which regulator (SDAIA vs. the ICO/EU authorities) and PDPL's own cross-border transfer mechanism, not response speed.

### 1.8a Data Protection & Privacy Compliance Module (new — separate from Tender Readiness)
This is a genuinely distinct module from Tender Readiness, not a duplicate — worth building for a specific reason beyond "the LinkedIn post looked relevant."

**Why it's a separate module, not folded into Tender Readiness:** Tender Readiness covers AI-specific governance (AI use inventory, AI Act risk classification, AI procurement questions). PDPL/GDPR-style data protection is broader and AI-agnostic — it applies to *any* company handling personal data, whether or not they use AI at all. Different regulatory domain, different evidence needed (consent flows, data-subject-request handling, retention policies, breach-response readiness), different buyer trigger (a data protection audit request, not necessarily an AI-specific one).

**Where I'd actually start, and why not PDPL first:** your own market sequencing is UK/NL first, Gulf third — and GDPR (the UK/EU equivalent of PDPL) is already fully in force and highly relevant to your *current* target market, not a future one. So the honest build order is: research and build this module around **GDPR first** (relevant now, to UK/NL clients), and extend it to **PDPL specifically once Gulf entry is real** — reusing the same evidence engine and module structure, just a different regulatory reference set. Building PDPL-first for a market you're not targeting yet would be solving tomorrow's problem before today's.

**Sequencing:** research now (cheap, externally documented — same logic as Tender Readiness and AI Reliability Audit), build alongside or shortly after those two in V1/V2, since it reuses the same intake/reviewer/report infrastructure. Not gated on a live client trigger, for the same reason those two aren't.

**Confirmed design (2026-07-31) — branches by applicable regulation, not one flat checklist:** the module must read `companies.registration_country`/`uae_free_zone`/`customer_market_countries` (§1.8c) and branch its checklist/report logic accordingly, since a company can be subject to more than one regime simultaneously:
- **GDPR** (build first — relevant now to UK/NL customer markets) — triggered by `customer_market_countries` including an EU/UK market.
- **Saudi PDPL** — triggered by `customer_market_countries` including Saudi Arabia (extraterritorial, same as GDPR/EU AI Act).
- **UAE's layered regime** — triggered by `registration_country` = UAE: federal PDPL always applies, and DIFC Regulation 10 additionally applies only if `uae_free_zone` = difc. ADGM-registered companies get ADGM DPR 2021 instead.
Assuming a single law applies (e.g. building only a GDPR checklist and treating it as universal) would misrepresent a genuinely multi-jurisdiction company's actual exposure — the whole reason the schema was split in the first place.

### 1.8b Tender Readiness — Confirmed Design (2026-08-02)
The Feature → Task Breakdown checklist for this module (§5) has been EU-AI-Act-only since it was first written — a real scope gap, not a deliberate simplification. The actual researched design (§1.8c) covers EU, UAE, and Saudi Arabia, and Tender Readiness must apply all three, not just the EU AI Act.

**Domain boundary, same discipline already applied to Data Protection Compliance (§1.8a) in reverse:** Tender Readiness covers *AI-specific* governance/risk-classification content only. Federal PDPL, ADGM DPR 2021, Saudi PDPL, and GDPR are general/AI-agnostic data-protection regimes — that's Data Protection Compliance's domain (§1.8a), not this module's, even though they're part of the same UAE/Saudi regulatory landscape researched in §1.8c. Concretely, Tender Readiness's applicable sections are:
- **EU AI Act** — the 4-tier risk classification (unacceptable/high-risk/limited/minimal).
- **UAE DIFC Regulation 10** — the one AI-*specific* rule in the UAE's layered regime (federal PDPL and ADGM DPR 2021 are data-protection-general, not AI-specific — Data Protection Compliance's job).
- **Saudi AI governance** — SDAIA's 7 AI Ethics Principles (indirectly enforced via PDPL/sectoral regulators/procurement, not a standalone AI statute) plus the still-draft, 4-tier Responsible AI Policy — distinct from Saudi PDPL itself (Data Protection Compliance's job).
- **UAE AI Charter** — non-binding, principles-based reference content only when `registration_country` = UAE; never treated as a compliance obligation the way DIFC Reg 10 is.

**Applicability is deterministic, computed in code — never AI-judged (confirmed 2026-08-02).** Same reasoning as the numeric-benchmark-comparison fix (metrics.ts): which sections apply is a factual, rules-based question with a right answer, not something to leave to LLM interpretation.
- `customer_market_countries` includes an EU member state → EU AI Act section applies.
- `customer_market_countries` includes Saudi Arabia → Saudi AI governance section applies (extraterritorial, same trigger signal as GDPR/Saudi PDPL elsewhere).
- `registration_country` = UAE AND `uae_free_zone` = difc → DIFC Regulation 10 section applies.
- `registration_country` = UAE (any zone) → UAE AI Charter shown as non-binding reference content.
- Multiple sections can and will apply simultaneously to the same company — a DIFC-registered company with EU and Saudi customers gets all three substantive sections at once.
- Once code has determined which sections apply, the AI's job is narrower: draft checklist content and findings *within* those already-determined sections. It never decides applicability itself.

**A real test-case suite is required before this is trusted in production (confirmed 2026-08-02) — same discipline as everything else in this build.** Deterministic logic still needs to be proven against real scenarios, not just typechecked. Minimum required cases: a UK-registered company with Saudi customers (Saudi section only), a DIFC-registered company with no Gulf/EU customers (DIFC only), a UK-registered company with EU customers (EU AI Act only), and a DIFC-registered company with both EU and Saudi customers (all three at once). See `src/lib/modules/tender-readiness/jurisdiction.ts` for the implementation and its committed test cases.

**Periodic regulatory-content-review flag (confirmed 2026-08-02; extended 2026-08-03 to also cover Data Protection Compliance) — a distinct concern from re-audit reminders.** Re-audit reminders (§2.3a, `scheduled_jobs`) are about a *client's* data going stale. This is about the *regulatory reference content itself* going stale — Saudi's Responsible AI Policy is still in draft consultation, and the UAE's Federal Authority for AI and Data (established June 2026, §1.8c) could issue binding rules affecting DIFC Reg 10 or the AI Charter's status at any time. Reuses the same `app_settings`-driven cadence mechanism already built for `re_audit_reminder_days` (not a new scheduling concept), but tracks per-jurisdiction "last reviewed" dates independently, since content evolves at different paces (Saudi fastest right now). A cron check flags jurisdictions overdue for human re-verification — logged as a reviewer notification, never silently left to go stale. **Real gap found and closed 2026-08-03**: this was built and verified against only Tender Readiness's three sections — Data Protection Compliance's regulations (UK GDPR, EU GDPR, and now Saudi PDPL, §1.8d) were never added, despite the mechanism itself being fully jurisdiction-agnostic (closing the gap needed only new seed rows, zero code changes). Also newly built: the per-jurisdiction last-reviewed date is now surfaced visibly on the reviewer queue (it previously only drove a backend notification, with no display anywhere), alongside a "Mark reviewed" action per jurisdiction, closing the loop on `markRegulatoryContentReviewed()` — a function that existed with no caller until now.

### 1.8c Multi-Jurisdiction Regulatory Landscape (research pass, 2026-07-31)
Feeds the Tender Readiness, AI & Governance, and Data Protection Compliance frameworks. Verified against primary/secondary sources as of this date — Saudi content in particular is actively evolving; re-verify before Gulf entry rather than treating it as settled.

**EU (current market, UK/NL sequencing):**
- EU AI Act entered into force 1 August 2024, fully applicable 2 August 2026. Four-tier risk classification: unacceptable (prohibited practices, applicable since 2 February 2025) / high-risk (8 Annex III categories: biometric ID, critical infrastructure, education, employment, essential services access, law enforcement, migration/border control, administration of justice) / limited / minimal.
- GPAI (general-purpose AI model) provider obligations applicable since 2 August 2025.
- High-risk Annex III systems' compliance deadline deferred from 2 August 2026 to 2 December 2027 under the Digital Omnibus (provisional agreement 7 May 2026, pending formal adoption — not yet finalized).
- GDPR is already fully in force — drives the Data Protection Compliance module's GDPR-first build (§1.8a).

**UAE (Gulf entry, third in sequencing):** no single "UAE AI Act" — a layered, jurisdiction-dependent regime. Do not build around the idea of one unified law.
- **Federal PDPL (Decree-Law 45/2021) — correction, 2026-08-03: already fully in force since 2 January 2022, not a future 1 January 2027 deadline as originally written here.** The "1 January 2027" figure was factually wrong — verified directly against the UAE's official government platform (u.ae/en/about-the-uae/digital-uae/data/data-protection-laws), which states the law "came into force on 2 January 2022" with no mention of any 2027 date. This was the exact same class of error already caught and fixed for Saudi PDPL (§1.8d): conflating "Gulf isn't launched as a market yet" (a real business-sequencing reason) with "the law isn't in force yet" (a false factual claim). Enforcement has escalated since 2025 (UAE Data Office investigating complaints, issuing fines). One genuine open item, not yet resolved: as of mid-2026, the law's executive regulations haven't been formally published in the Official Gazette, though the UAE Data Office has issued operational guidance in their absence (e.g. a de facto 72-hour breach-notification standard) and the law itself remains enforceable regardless. Per this correction, federal PDPL should be treated the same as Saudi PDPL going forward — built into Data Protection Compliance now, not deferred to Gulf market entry. ADGM DPR 2021's own enforcement timeline was not independently re-verified in this pass and should not be assumed to follow the same correction without checking.
- DIFC Regulation 10 (AI-specific): applies only to DIFC-registered entities, full enforcement since January 2026.
- ADGM Data Protection Regulations 2021: separate free zone, GDPR-aligned, general privacy regime — no AI-specific equivalent to DIFC Reg 10, but existing privacy-by-design/impact-assessment requirements apply to AI systems.
- UAE AI Charter (June 2024): non-binding, principles-based reference point, not enforceable law.
- Federal Authority for AI and Data, established 14 June 2026: consolidates the UAE AI Office, TDRA's digital-government sector, and the Emirates Data Office under one body reporting to Cabinet. Watch for binding rules to emerge from here before Gulf entry.

**Saudi Arabia (Gulf entry, third in sequencing):**
- SDAIA AI Ethics Principles (September 2023, v1.0): 7 principles — Fairness, Privacy & Security, Humanity, Social & Environmental Benefits, Reliability & Safety, Transparency & Explainability, Accountability & Responsibility. Enforcement is indirect: via PDPL when personal data is involved, sectoral regulators, and government procurement consequences — not a standalone AI statute with its own penalty regime.
- April 2026: SDAIA published a National AI Risk Management Framework (live, not draft) — the first national-level guide for identifying/assessing/treating/monitoring AI risk.
- Separately, a draft "Responsible AI Policy" (public consultation via the Istitlaa platform, closed 3 May 2026, not yet final) introduces its own 4-tier risk framework: critical/high/limited/low.
- These two SDAIA artifacts are related but distinct, and how they'll ultimately combine isn't fully resolved from available sources — re-verify before Gulf entry. This is layered on top of, not a replacement for, Saudi PDPL (§1.8 forward-looking note).

**Architecture implication — jurisdiction is two signals, not one:** EU AI Act, GDPR, and Saudi PDPL are extraterritorial (triggered by where the company's *customers/end-users* are). UAE's DIFC Regulation 10 and ADGM rules are triggered by where the *company itself is registered*. Both can apply simultaneously to the same company. `companies.country` was split into `registration_country` (+ `uae_free_zone` sub-field for mainland/DIFC/ADGM) and `customer_market_countries` (multi-select) — see §3 schema. Tender Readiness / AI & Governance / Data Protection Compliance checklist logic should read registration jurisdiction for UAE-specific rules and customer market countries for EU AI Act/GDPR/Saudi PDPL.

**Correction (§1.8d, 2026-08-02):** the "GDPR is extraterritorial, triggered only by customer markets" framing above is incomplete for GDPR specifically (it's accurate for EU AI Act and Saudi PDPL). GDPR Article 3 has *two* independent triggers — extraterritorial reach (3(2), customer-market-based, as stated above) *and* establishment (3(1), registration-based) — and either alone is sufficient. A UK-registered company selling only outside the UK/EU is still bound by UK GDPR via establishment even with zero UK/EU customer exposure. See §1.8d for the corrected, implemented logic.

### 1.8d Data Protection Compliance — Confirmed Design (2026-08-02; extended 2026-08-03 with Saudi PDPL)
GDPR-first build order (§1.8a), but Saudi PDPL is now a real, built branch — **correction, 2026-08-03: PDPL is already actively enforced in Saudi Arabia today, not a future law waiting on Gulf market entry.** The original framing here ("Saudi PDPL is a deliberate, deferred extension... triggered once Gulf market entry is real") conflated PDPL with the UAE's data-protection regime, which genuinely is Gulf-entry-gated (no live UAE client exposure yet) — PDPL is not in the same category and should never have been deferred on that basis. The UAE's data-protection regime (federal PDPL, ADGM DPR 2021) remains out of scope for the original reason. Genuinely distinct from Tender Readiness, not overlapping: Tender Readiness is AI-specific governance (AI use inventory, AI Act/DIFC Reg 10/SDAIA risk classification); Data Protection Compliance is broader and AI-agnostic — it applies to any company handling personal data, whether or not it uses AI.

**Five core checklist categories (§1.8a, §5 task breakdown — unchanged, already correctly scoped):** consent-flow review, data-subject-rights readiness (access/correct/delete/port), retention policy review, breach-response readiness, cross-border transfer check. Every applicable regulation — GDPR variants and PDPL alike — is assessed across all five categories; categories are not regulation-specific subsets.

**Applicability is deterministic, computed in code — never AI-judged, same reasoning as Tender Readiness's jurisdiction.ts.** Three regulation flags (`ukGdpr`, `euGdpr`, `saudiPdpl`), each with two independent triggers, all implemented (correcting §1.8c's customer-market-only framing, see above):
- **Establishment** — `registration_country` is the UK (→ `ukGdpr`), an EU member state (→ `euGdpr`), or Saudi Arabia (→ `saudiPdpl`), regardless of where customers are. PDPL applies to any controller established/residing in Saudi Arabia, the same establishment-based trigger as GDPR Article 3(1).
- **Extraterritorial reach** — `customer_market_countries` includes the UK, an EU member state, or Saudi Arabia, regardless of where the company is registered. PDPL applies extraterritorially to processing of Saudi residents' data where that processing relates to offering them goods/services — the same structure as GDPR Article 3(2).
- Any combination of the three can be true simultaneously (e.g. a UK-registered company with EU and Saudi customers is subject to all three at once) — the module must not assume only one applies.
- When multiple regimes apply, they are treated as near-identical in substance but flagged as procedurally distinct where they genuinely diverge: UK GDPR vs EU GDPR diverge post-Brexit on breach notification (ICO vs. the relevant national supervisory authority) and cross-border transfer adequacy mechanisms (UK's own adequacy regulations vs. the EU Commission's, now diverged). Saudi PDPL diverges from both GDPR variants on regulator (SDAIA, not the ICO/EU authorities) and cross-border transfer mechanism (PDPL restricts transfers outside Saudi Arabia unless a SDAIA-recognized adequacy decision, approved contractual safeguards, or another SDAIA-sanctioned mechanism applies — a genuinely separate machinery from GDPR's SCC/adequacy-decision framework). **Correction to an inaccurate claim in §1.8's original forward-looking note:** PDPL's 72-hour breach-notification window is not "stricter than a GDPR-only posture" — GDPR/UK GDPR Article 33 also requires notification to the supervisory authority within 72 hours where feasible. The two regimes use the same timeframe; the substantive difference is which regulator gets notified, not how fast.

**A real test-case suite is required before this is trusted in production — same discipline as Tender Readiness's 10/10 suite.** See `src/lib/modules/data-protection-compliance/jurisdiction.ts` and its committed test cases (`jurisdiction.test-cases.ts`, 12/12 passing), covering: a UK-registered company with UK/EU customers (UK+EU GDPR apply), a company with no EU/UK/Saudi customer exposure and non-EU/UK/Saudi registration (nothing applies), a UK-registered company with only non-EU/UK customers (UK GDPR still applies via establishment alone), a non-EU/UK-registered company with EU customers (EU GDPR via extraterritorial reach alone), a UK-registered company with Saudi customers (PDPL via extraterritorial reach alongside UK GDPR via establishment, not EU GDPR — the direct data-protection-domain parallel to Tender Readiness's original "UK-registered with Saudi customers" AI-governance test case), a Saudi-registered company with no other markets (PDPL via establishment alone), a non-Saudi-registered company with only Saudi customers (PDPL via extraterritorial reach alone), a company triggering all three regimes at once, and case-insensitivity/null-input handling.

**Architecture — reuses the generic module review mechanism, no new pattern needed:** same `module_requests`/`module_findings` tables and shared reviewer workflow (Accept/Edit/Reject/Approve) as AI Reliability Audit and Tender Readiness (see "Generic module review architecture"). `module_type = "data_protection"`. Per-category "missing evidence is itself a finding" — guaranteed in code per blank category, not module-wide, since each of the five areas is its own distinct compliance gap; a proactive prompt rule plus a deterministic backstop filter (dropping any LLM-produced finding for a category with no evidence) were built in from the outset rather than discovered live, since this exact failure mode (the LLM re-raising a topic already covered by a guaranteed finding) had already recurred three times across AI Reliability Audit and Tender Readiness — and it held on first live test with PDPL added, no bug-fix cycle needed.

### 1.9 Service Layer (human touchpoints alongside the software)
The product is software-first, but several human-delivered moments are part of the actual offer, not incidental to it. **Confirmed 2026-08-02: two onboarding-shaped things that look similar must stay distinct, shown side by side, not one replacing the other.**

**Onboarding — two distinct things:**
- **Guide (self-serve, always on)** — in-app help text, upload instructions, evidence-export hints. Available to every client automatically, no call involved, no gate before uploading. A client can go straight from signup to uploading evidence with zero human interaction if they want to, on either tier.
- **Discovery Session (genuinely optional live call)** — offered, never required, helping a client frame their goal and gather better evidence before they start uploading. Standard tier: offered but optional, skippable entirely. Concierge/White-Glove tier: included by default.

- **Expert review** — the mandatory human validation step before any report is sent (see §2.3, step 8). Identical for every tier — no shortcut exists at any price point; Concierge means more reviewer attention to ambiguous findings, never less review.
- **Delivery Session (live call, post-report)** — walks through the top 3 bottlenecks, what matters most, and where AI is/isn't worth it yet. **Premium, not included in the free/Standard tier**, which includes only the written report + dashboard. Bundled by default with the paid Execution Sprint, or sellable standalone as a smaller add-on. Included by default on the Concierge/White-Glove tier.
- **F2F Workshop** — a premium upgrade *of* the Delivery Session specifically: in-person, potentially multi-stakeholder. Never offered before evidence submission — it needs real findings to discuss, so it can only ever follow a completed report. Available as a further upgrade on top of the Concierge/White-Glove tier.
- **Implementation scoping** — translating the blueprint into the first Execution Sprint
- **Optional monthly advisory** — review progress, re-rank priorities, refresh roadmap (feeds into the eventual Monthly Execution Office)

**Concierge/White-Glove tier (confirmed 2026-08-02)** — a new tier alongside the Standard/free Core Audit (see §1.5 for pricing). Same underlying five-lens engine, Conflict Detection, and mandatory review — **no new technical pipeline**. The difference is entirely human attention: Discovery Session and Delivery Session both included by default, the reviewer gives deeper attention to ambiguous/borderline findings, and the F2F Workshop is available as a further upgrade on top of that.

This is the "consultation service" layer — it's not a separate product, it's the trust/interpretation layer wrapped around the software.

**Engineering note (not yet built):** `users.plan_tier` already exists in the schema (§3), currently unused beyond its `'free'` default — the natural home for Standard vs. Concierge, rather than a new field. "The reviewer gives deeper attention to ambiguous findings" is a service policy today, not something any code enforces or even surfaces — the Reviewer Workspace has no tier indicator yet, so a reviewer currently has no in-app signal for which reports warrant that extra attention. Recommend surfacing `plan_tier` as a visible badge in the Reviewer Workspace once tiers actually launch, so the policy is followable, not just documented — not built now, flagged for when Concierge tier ships. Similarly, the F2F Workshop's "not before evidence submission" rule will need real enforcement in whatever booking/scheduling UI eventually exists — no such UI exists yet, so today this is policy, not a gate.

### 1.9a Gap-Assessment Methodology Alignment (research pass, 2026-08-02)
Checked the core audit's structure against real gap-assessment frameworks (McKinsey 7S, standard gap-analysis models) to confirm the product isn't accidentally missing a standard step. **Verdict: the standard four-step structure (current state → future state → gap → action plan) already maps onto what's built** — evidence + five-lens findings are the current state, each lens's benchmark comparison is the gap, the 30/60/90 roadmap is the action plan. Not duplicate work, nothing to rebuild.

**One genuinely missing, additive piece, confirmed for build:** real gap-assessment methodology has the client explicitly articulate their own desired future state in their own words, not just get compared against a generic external benchmark. Add a short, optional prompt per selected goal during intake — *"Optional: in your own words, what would good look like here for your business?"* — captured and shown alongside the benchmark comparison in the final report, so the client sees both how they compare to the external norm and to their own stated ambition. **This is new, deliberate scope, not something silently folded into existing goal capture** — affects the `goals` schema (§3), intake step 1, and the report template (§2.3 step 10; report generator not yet built).

**Confirmed 2026-08-02: always client-provided, one mechanism only.** Regardless of whether the client went through a Discovery Session or skipped straight to self-serve upload, this field is always client-authored — no consultant-recorded version, no dual capture path. Validation is basic length/spam only (a reasonable max length, reject empty/whitespace-only or degenerate repeated-character input) — deliberately no AI content-quality check, since judging whether a client's own words are "good enough" isn't this feature's job.

**Report-level rule for when it's left blank (confirmed 2026-08-02):** since it's optional, it will sometimes be empty — don't leave it silently absent in the report. Show a short, neutral note instead, e.g. *"You haven't yet defined what success looks like here in your own words — worth discussing in your next Discovery or Delivery Session."* Same pattern already established elsewhere in this build for a structural absence (missing financial visibility, missing AI governance documentation): an absence becomes a small, honest, actionable note, not something that just disappears. Applies at report-generation time (§2.3 step 10; report generator not yet built) — documented here now since there's nowhere in code yet to encode it.

**Worth considering later, not requested now:** this text could also feed the lens prompts themselves (via `formatGoalContextForPrompt`) so recommendations are framed against the client's own stated ambition, not just the external benchmark — a cheap extension once the field exists, but out of scope for this pass since only capture + display were asked for.

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
- **No auto-approve mechanism yet, deliberately (confirmed 2026-07-31).** The right granularity for auto-approving findings (per-lens? per-finding-type? per-confidence-threshold?) isn't known yet, and guessing now risks rebuilding later. Every finding still requires mandatory human review, no exceptions — but `lens_findings` captures the data (confidence level, reviewer disposition, client dispute outcomes) that a future auto-approve design will need, so that decision can be made from real patterns later rather than guessed now. See §3 schema.

### 2.2 Tech Stack
- **Frontend/Backend:** Next.js (App Router), same as Elvanis
- **Database/Auth/Storage:** Supabase — **new, separate project** (not shared tables in Elvanis's instance)
- **AI:** Groq via internal `ai-client` abstraction (model name in config/env, not hardcoded per call site)
- **Email:** Resend (reuse pattern from Elvanis)
- **File parsing:** CSV parser + PDF/text extraction + OCR fallback for screenshots

### 2.3 High-Level Data Flow
0. **Digital Presence Scan (free, optional, pre-signup)** — company name/URL only, no login; pulls public signals (website, socials, reviews, mentions); B2B-vs-B2C-aware scoring baseline (a thin public footprint is a real finding for a B2C brand, often normal for B2B); this is a trust-building/lead-in tool, not a substitute for real evidence
1. **Company Profile & Goal** — client creates profile (auto-populated from public data where available, e.g. company name, industry, size signals), selects primary goal (weighting layer, not a lens); for each goal selected, a short open-ended prompt — *"in your own words, what would good look like here?"* (§1.9a) — is captured alongside the structured goal fields; profile is a living record, re-read fresh by every prompt generation, not cached at signup
2. **Evidence Intake** — per lens, client uploads a native export *or* fills a template *or* both; the known-source template library auto-detects recognized tool exports (Xero, HubSpot, Jira, etc.) and applies the right field-mapping automatically; unrecognized files fall back to generic parsing; produces a merge-and-complete page showing populated + blank required fields
3. **Evidence Sufficiency Check** — per lens, evidence is checked against minimum thresholds; insufficient evidence either blocks the lens (with explanation) or is itself logged as a finding (e.g. "no financial visibility" as an Execution-lens finding)
4. **Five-Lens AI Drafting** — parallel AI calls: Financial, Commercial/Market, Execution/Operating, Product/Customer, AI & Governance (governance sub-branches: questionnaire mode if no existing docs, document-review mode if client uploads governance material)
5. **Conflict Detection** — findings across lenses are checked against each other for contradictions (e.g. Financial lens implies healthy margin while Execution lens implies major cost drag) before prioritization; flagged conflicts are surfaced to the reviewer, not silently resolved by the AI
6. **AI Opportunity Synthesis** — separate synthesis pass reading all five lenses' approved findings + a Readiness sub-check (data quality, team skill, process maturity) → tags each opportunity "do now" vs. "fix groundwork first"
7. **Financial Impact Estimator** — produces ranges + confidence + stated assumptions, not false precision
8. **Reviewer Workspace (mandatory gate)** — you accept/reject/edit findings, resolve flagged conflicts, re-rank priorities using "fix this first" logic, adjust financial bands, add context; report cannot move to `sent` status without this approval step
9. **Notifications** — client notified when report is ready; you (reviewer) notified on new submission and on evidence-completeness milestones; email via Resend, same pattern as Elvanis
10. **Report & Client Dashboard** — top 3 bottlenecks, root causes, financial impact, AI opportunity map, the client's own stated desired-future-state shown alongside each lens's benchmark comparison (§1.9a), 30/60/90 roadmap, next-module CTAs
11. **Case Library Write** — every completed audit stored/tagged (v1: storage only; v2: retrieval activates)
12. **Scheduled Jobs (crons)** — re-audit reminder cadence, evidence-completeness nudges, Execution Sprint progress check-ins, Monthly Execution Office refresh triggers

### 2.3a SLA & Submission Flow (confirmed 2026-07-31)
Expands steps 2, 8, and 9 above with the actual client-facing timing contract.

- **72-hour SLA, shown to the client as a single promise everywhere outside the submit-confirmation moment:** "Your report will be ready within 72 hours" is the number used in headline/marketing copy, the dashboard, and anywhere else the SLA is referenced generally. **Correction, 2026-08-03**: this was originally written as "the internal two-part breakdown below is never exposed," which directly contradicted this same section's own confirmation-modal text two lines down — that modal correctly and intentionally discloses the 24-hour edit window, because the client needs to know it before deciding to submit (it's operationally relevant to their choice, not an internal implementation detail). The code correctly implements the modal text below; the "never exposed" framing was the actual error and is retracted — it only ever applied to headline/marketing copy, not this functional confirmation moment.
- **Uploading evidence has no clock.** Clients can take whatever time they need gathering evidence before submitting — encourage this, don't rush it.
- **"Submit for Review" is an explicit action, distinct from uploading**, gated behind a confirmation modal: *"Ready to submit? You'll have 24 hours to edit or add evidence — after that, review begins, and your report will be ready within 72 hours total. This will use your free audit."* (Confirm/Cancel.)
- **Internal breakdown:** 24-hour edit window after "Submit for Review" (client can still revise/add evidence; no reviewer activity yet) + 48-hour review period, which starts only once the edit window closes. The reviewer notification (step 9) must fire the instant the 24-hour window closes — a `scheduled_jobs` trigger, not something left to a human to notice — so the 48-hour clock starts accurately.
- **New evidence submitted after a report has already been delivered starts a new, distinct re-audit cycle** — never a silent edit to the sent report. Reuses the existing re-audit workflow/cron (`scheduled_jobs`: `re_audit_reminder`). The original report stays untouched in Reports & History (consistent with the frozen-snapshot principle, §2.5).
- **Free tier = the first completed audit per company only**, however long evidence-gathering took. Any full re-audit after a report has been delivered is paid (Execution Sprint / re-audit pricing / eventual Monthly Execution Office §1.5) — never free again.

### 2.4 Module Boundaries
- **Tender Readiness**, **AI Reliability Audit**, and **Data Protection Compliance** are all built on externally researchable material — none require a live client trigger to build a solid v1. Each has its own intake, findings schema, report template, and standalone entry page, built on the shared core engine once it's stable.
- **AI Opportunity** is *not* a module — it has no standalone table beyond being an output section linked to a given audit's synthesis result.

### 2.5 Information Architecture — Four Separate Areas, Not One Page
Recommendation: keep these genuinely separate, not combined into one "profile" page, because they answer different questions and change at different rates.

- **Account Settings** — about the *person* logging in: name, email, password, notification preferences, plan/subscription and billing. Changes rarely, personal, not client-facing content.
- **Business Profile** — about the *company being diagnosed*: brand name, website URL, social/review links, industry, business model, goals (current + history), tools/stack. This is the living record every lens prompt reads from — it changes occasionally, and its accuracy directly affects diagnosis quality. One company per account for now (V1, confirmed 2026-07-31; DB-enforced, see §3) — no multi-company support yet. This does NOT mean one country: `registration_country`/`uae_free_zone` and `customer_market_countries` are independent and can differ for the same company (e.g. registered in Saudi Arabia, selling to UK customers) — see §1.8c.
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
  id, user_id (fk, UNIQUE), name, website_url, social_links (jsonb), industry, business_model (B2B/B2C),
  registration_country, uae_free_zone (mainland/difc/adgm, only meaningful when registration_country = UAE),
  customer_market_countries (text[]), employee_count, stage, revenue_range_band, customer_type,
  main_tools_stack (jsonb), team_structure_summary, created_at, updated_at, privacy_acknowledged_at
  -- country split into two independent jurisdiction signals (§1.8c): registration_country drives
  -- UAE DIFC/ADGM-style rules, customer_market_countries drives extraterritorial regimes
  -- (EU AI Act/GDPR/Saudi PDPL) — both can apply to the same company simultaneously, and are
  -- read independently by any regulatory check — never assume they match
  -- user_id UNIQUE confirmed 2026-07-31: one company per account for now (V1), enforced at the
  -- DB level, not just a UI convention — same philosophy as the mandatory review gate. Will need
  -- removing when multi-company support ships (V2+)

company_profile_history
  id, company_id (fk), changed_field, old_value, new_value, changed_at
  -- ensures prompts always read current profile state, and changes are auditable

digital_presence_scans
  id, company_url_or_name, industry_hint, business_model_hint (B2B/B2C),
  public_signals (jsonb), presence_score, findings_summary, is_linked_to_company_id (fk, nullable)
  -- free, pre-signup entry point; not evidence, purely a trust-building lead-in

goals
  id, company_id (fk), primary_goal, secondary_goal (nullable),
  urgency_level, target_metric, time_horizon, success_definition,
  desired_future_state_primary (nullable), desired_future_state_secondary (nullable)
  -- confirmed 2026-08-02 (§1.9a): client's own words on "what would good look like"
  -- per selected goal, captured at intake and shown alongside each lens's benchmark
  -- comparison in the final report — new, deliberate scope, not folded silently
  -- into the existing structured goal fields above

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
  is_missing_data_finding (bool), origin (client_reported/ai_independent, nullable),
  client_confidence_marking (accurate/not_confident, nullable), is_disputed (bool, default false),
  dispute_resolution_notes, created_at
  -- origin/client_confidence_marking/is_disputed/dispute_resolution_notes confirmed 2026-07-31:
  -- Commercial/Market's hybrid design needs client source-tagging ("you told us this" vs
  -- "we found this independently") and a dispute flow (client marks an ai_independent finding
  -- not_confident -> dropped from client view, still surfaced to the reviewer for resolution).
  -- Pure data capture alongside confidence_level/reviewer_status — feeds a future auto-approve
  -- design once the right granularity is known; no auto-approve behavior exists yet, and
  -- mandatory review is unchanged for every finding.

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

-- Generic standalone-module review architecture (confirmed 2026-08-02) — replaces
-- what were three separate *_requests tables (tender_readiness_requests,
-- ai_reliability_requests, data_protection_requests) with one pair shared across
-- all three modules. Same principle as AI & Governance not being forced into the
-- shared LensModule interface: reuse the REVIEW MECHANISM (Accept/Edit/Reject/
-- Approve, the confidence/edit-tracking log, the reviewer queue — same
-- report_status/reviewer_status enums as reports/lens_findings), but don't force
-- every module's findings into lens_findings' exact structure (goalRelevance tied
-- to the 5-goal menu, financialImpact, etc. don't genuinely apply to a standalone
-- module). Module-specific intake shape (ai_use_inventory, consent_flow_review,
-- adversarial-test evidence, etc.) lives in intake_data jsonb instead of separate
-- typed columns per module — it doesn't generalize, so it isn't forced to.

module_requests
  id, module_type (ai_reliability/tender_readiness/data_protection), company_id (fk),
  status (report_status: draft/pending_review/approved/sent), intake_data (jsonb),
  submitted_at, edit_window_closes_at, reviewer_notified_at, reviewed_by (fk),
  approved_at, delivered_at, created_at
  -- same "sent requires a reviewer" check constraint as reports

module_findings
  id, request_id (fk), module_type, ai_draft (jsonb — diagnosis/rootCause/recommendedAction/
  severity, same structure as LensFinding minus goalRelevance/financialImpact/origin/dispute),
  reviewer_status (reviewer_status: draft/edited/approved/rejected), reviewer_notes,
  reviewer_edited_content (jsonb), confidence_level, is_missing_data_finding, created_at

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
- Cleaner onboarding polish *(→ moved to V1, built 2026-08-05 — converged with the multi-step guided workflow and goal definition wizard into one build, see CLAUDE.md "Onboarding wizard + goal definition wizard")*
- Saved draft intake — V2
- Teammate invite for evidence completion — V2
- Goal definition wizard *(→ moved to V1, built 2026-08-05 — see CLAUDE.md "Onboarding wizard + goal definition wizard")*
- Reusable templates by company type — V2 (needs multiple company types actually seen)

**2. Better analysis depth**
- Deeper Product/Customer lens — V2
- Deeper AI & Governance lens — V2
- Better Commercial/Market lens *(→ moved to V1, built 2026-08-05 — search-query quality + root-cause depth improvements, see CLAUDE.md "Deeper Commercial/Market lens"; the benchmark-library item immediately below stays V2, deliberately not folded into this)*
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
- [ ] "In your own words, what would good look like here?" prompt per selected goal (§1.9a), captured into `desired_future_state_primary`/`desired_future_state_secondary`

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

**Evidence Intake — sequencing confirmed 2026-08-03: fill-in-template path first, native upload/parsing as a real, explicitly deferred follow-on (not implied, not silently dropped)**
- [ ] Per-lens fill-in template — build this first; part of the Priority 1 minimal end-to-end client path (sign in → create company/goal → submit evidence → see the resulting report, no stub anywhere in that chain)
- [ ] Evidence sufficiency check per lens (block, or log as finding, per lens rules) — part of the same Priority 1 pass, since the fill-in path needs it to behave correctly
- [ ] Merge-and-complete page: pre-filled + blank required fields, single view — applies once native upload exists too; for the fill-in-only pass this collapses into the fill-in form itself
- [ ] **DEFERRED, confirmed real remaining scope, not dropped**: per-lens native export upload (CSV/PDF) with field auto-mapping (reuse/extend Elvanis Anchor Column logic)
- [ ] **DEFERRED, confirmed real remaining scope, not dropped**: known-source template library — recognize common exports (Xero, QuickBooks, HubSpot, Salesforce, Jira, Intercom, Zendesk) by signature, auto-apply correct mapping (`export_source_signatures` table already exists in schema for this, unused until built)
- [ ] **DEFERRED, confirmed real remaining scope, not dropped**: generic parsing fallback for unrecognized files

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
- [ ] In-app Guide (self-serve help text, upload instructions, evidence-export hints) — always on, every tier, no gate before uploading
- [ ] Discovery Session flow/script (optional live call, offered pre-evidence; included by default on Concierge tier, optional add-on on Standard)
- [ ] Delivery Session template (live call structure, post-report; premium, not in free/Standard tier — bundled with Execution Sprint or sellable standalone)
- [ ] F2F Workshop structure (premium upgrade of Delivery Session specifically, in-person/multi-stakeholder, post-evidence only — never before findings exist)
- [ ] Concierge/White-Glove tier flag on `users.plan_tier` + Reviewer Workspace tier badge, so "deeper reviewer attention" is actually followable, not just documented policy
- [ ] Implementation scoping handoff into Execution Sprint
- [ ] Optional monthly advisory touchpoint (feeds Monthly Execution Office later)

**Tender Readiness Module (built in V1, after core engine is stable; confirmed design 2026-08-02, see §1.8b — full EU/UAE/Saudi scope, not EU AI Act only)**
- [ ] Research: EU AI Act risk-classification criteria, UAE DIFC Regulation 10 + AI Charter, Saudi SDAIA AI Ethics Principles + draft Responsible AI Policy, real procurement questionnaires, competitor report structures (Verumt, Flutteris, Legalithm)
- [ ] Deterministic jurisdiction-applicability logic (code, never AI-judged) + committed test-case suite proving it before trusting it in production
- [ ] Design checklist/question set/report template per applicable section from that research
- [ ] AI use-case inventory intake
- [ ] Risk classification logic (within each code-determined applicable section)
- [ ] Missing-documentation gap finder
- [ ] Draft procurement-answer generator
- [ ] Evidence pack builder/export
- [ ] Periodic regulatory-content-review flag (per-jurisdiction, reuses the `app_settings` cadence mechanism)
- [ ] Standalone entry page (sellable independent of core audit)

**Infrastructure**
- [ ] New, isolated Supabase project
- [ ] `ai-client` provider-abstraction module
- [ ] Case library storage schema (retrieval logic deferred to v2)

**AI Reliability Audit Module (built in V1, after core engine is stable — same treatment as Tender Readiness; confirmed design 2026-08-02, see §1.7a)**
- [ ] Research: documented real-world AI failure patterns (Air Canada, Cursor, legal-citation hallucination cases) and known adversarial-testing categories (invented policy, data leakage, bias, prompt injection)
- [ ] System-type clarifying question (conversational vs. agent/automation) — decides intake branch
- [ ] Conversational path: guided self-test prompt library per category + client transcript-paste intake (evidence-based, no live execution)
- [ ] Agent/automation path: trace-log/incident-history, credential/attributability, and human-escalation intake
- [ ] Deterministic guaranteed finding when the agent/automation path has zero trace logs/execution history (governance gap, never left to LLM discretion)
- [ ] Failure-mode/escalation review
- [ ] Reliability risk summary + remediation recommendations
- [ ] Standalone entry page (sellable independent of core audit)

**Data Protection Compliance Module (built in V1, after core engine is stable; confirmed design 2026-08-02, extended 2026-08-03 with Saudi PDPL, see §1.8d — GDPR-first build order, deterministic UK GDPR/EU GDPR/Saudi PDPL applicability)**
- [ ] Research: GDPR requirements (consent, data-subject rights, retention, breach notification, cross-border transfer)
- [ ] Research: Saudi PDPL requirements (SDAIA-overseen consent, privacy notices, data-subject rights, 72-hour breach notification, cross-border transfer restrictions) — built now, not deferred; PDPL is already actively enforced, unlike the UAE's data-protection regime which genuinely is Gulf-entry-gated
- [ ] Deterministic jurisdiction-applicability logic (code, never AI-judged) + committed test-case suite proving it before trusting it in production
- [ ] Design checklist/report template from that research
- [ ] Consent-flow review intake
- [ ] Data-subject-rights readiness check (access/correct/delete/port)
- [ ] Retention policy review
- [ ] Breach-response readiness check
- [ ] Cross-border transfer check
- [ ] Standalone entry page (sellable independent of core audit)
- [ ] Later, when Gulf entry is real: extend with the UAE's data-protection regime (federal PDPL, ADGM DPR 2021) — Saudi PDPL is no longer part of this deferred item
