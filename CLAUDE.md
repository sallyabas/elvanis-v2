# AI Execution Audit Platform (relaunching as Elvanis)

Full spec (BRD, architecture, DB schema, roadmap): [docs/AI-Execution-Audit-Platform-BRD-Architecture-Roadmap.md](docs/AI-Execution-Audit-Platform-BRD-Architecture-Roadmap.md)
Read that file in full before starting any non-trivial task — this file is a summary/index, not a replacement for it.

## What this is
A goal-driven AI execution audit platform for founder-led B2B SaaS / tech-enabled SMEs (20–200 employees). Client picks a business goal, submits evidence (native tool exports or fill-in templates — no live integrations in V1), and the system runs five parallel AI-drafted lenses, which a human reviewer must approve before a client ever sees them. Output is a financially-quantified top-3-priorities + 30/60/90 roadmap, with an AI Opportunity section gated by a readiness check.

**Relaunch decision:** this ships under the existing Elvanis brand/domain (`app.elvanis.com`), not a separate company — but on genuinely fresh infrastructure (new GitHub repo, new Supabase project, new Vercel project). The old Elvanis app/DB is untouched, kept as reference/rollback, never shared or reused. Deploy on Vercel's free URL during build/pilot; DNS cutover to `app.elvanis.com` is the last step, done only after `RESEND_FROM_EMAIL` is verified working on the new project.

Market sequencing: UK → Netherlands/Europe → Gulf (gated on UK/NL proof).

## Non-negotiable architecture principles
- **No hardcoded provider calls.** Every LLM call goes through the internal `ai-client` abstraction (see `lib/ai-client/`) so switching model/provider is a config change, not a multi-file rewrite. Elvanis was already forced through one painful Groq migration — don't repeat that.
- **Mandatory human review gate.** A `reports` row can never reach `sent` status without passing `pending_review` → reviewer `approved`. This is enforced at the DB/workflow level, not just a UI convention. Every finding is `draft` → `reviewer_edited` (optional) → `approved` before it can appear client-facing.
- **Isolated infrastructure.** New Supabase project, new env vars, new domain path. Never touch the old Elvanis DB/repo/tables.
- **Evidence-in, structured-out, per lens.** Each of the five lenses is an independent AI call with its own strict output schema — one lens failing must not block the others.
- **Business profile is a living record.** Every lens prompt reads the *current* profile/goal/evidence state at generation time, never a cached copy from signup. Changes are tracked in `company_profile_history`.
- **Source-agnostic evidence intake.** No OAuth/live integrations in V1. Per-lens native export upload (CSV/PDF) or fill-in template, reconciled via a merge-and-complete step. A known-source template library (Xero, QuickBooks, HubSpot, Salesforce, Jira, Intercom, Zendesk) auto-maps recognized files; unrecognized files fall back to generic parsing.

## Stack
- Next.js (App Router), TypeScript
- Supabase — **new isolated project** (DB/Auth/Storage) — credentials supplied by user, never reuse old Elvanis project
- Groq via `ai-client` abstraction (model/provider name lives in config/env)
- Resend for email (same pattern as old Elvanis)
- CSV parsing + PDF/text extraction + OCR fallback for evidence files

## Five lenses (equal depth, always)
Financial · Commercial/Market · Execution/Operating · Product/Customer · AI & Governance (questionnaire mode or document-review mode)

## Goal menu (locked 2026-07-31)
Cash Flow/Margin Efficiency · Growth/Revenue Efficiency · Churn/Retention · Execution Speed · Product Delivery. Goal is a weighting layer every lens reads, not a lens itself (spec §2.3 step 1) — no separate AI/Tender Readiness goal, that's the Tender Readiness module's own entry point. See `src/lib/lenses/goals.ts`.

## Modules built in V1 (research-driven, not client-trigger-gated)
Built on the shared core engine (evidence intake, reviewer workspace, report generator) once it's stable — not before, not in parallel:
- **Tender Readiness** — AI Act risk classification, procurement questionnaire prep
- **AI Reliability Audit** — adversarial testing against documented real-world AI failure patterns
- **Data Protection Compliance** — standalone, same commercial pattern as Tender Readiness (post-audit by default, standalone if externally triggered). GDPR first (current UK/NL market), build in that order. Confirmed design (2026-07-31): branches by applicable regulation using `companies.registration_country`/`uae_free_zone`/`customer_market_countries` (§1.8c) — GDPR, Saudi PDPL, and UAE's layered regime (federal PDPL + DIFC Reg 10 if DIFC-registered) — never a single flat checklist assuming one law applies. A company can be subject to more than one regime at once.

Each has its own intake, findings schema, report template, and standalone entry page. Not started yet — still queued behind the two remaining core lenses (Commercial/Market, Product/Customer) per the explicit sequencing rule: these three modules wait until the five-lens core engine is fully done, not built in parallel.

## Information architecture — four separate pages, not one
- **Account Settings** — the person (name/email/password/notifications/billing)
- **Business Profile** — the company being diagnosed (living record every lens reads from)
- **Reports & History** — chronological, frozen-snapshot archive of every generated report
- **Dashboard** — current live state (latest top-3, roadmap status, active sprint)

## Database schema
Full schema is in §3 of the spec doc. Core tables: `users`, `companies`, `company_profile_history`, `digital_presence_scans`, `goals`, `evidence_submissions`, `evidence_files`, `evidence_fields`, `lens_findings`, `financial_impact_estimates`, `ai_governance_detail`, `ai_opportunity_synthesis`, `readiness_scores`, `priority_ranking`, `finding_conflicts`, `reports`, `notifications`, `execution_sprints`, `sprint_tasks`, `scheduled_jobs`, `case_library`, `monthly_retainers` (V3), `export_source_signatures`, `tender_readiness_requests`, `ai_reliability_requests`, `data_protection_requests`.

`companies.country` was split into `registration_country` + `uae_free_zone` (mainland/difc/adgm) and `customer_market_countries` (text[]) — see "Multi-jurisdiction regulatory landscape" below for why.

## Multi-jurisdiction regulatory landscape
Full research and sourcing in spec §1.8c — read that before building any jurisdiction-aware logic in Tender Readiness, AI & Governance, or Data Protection Compliance. Summary: regulatory applicability is two independent signals, not one "country" field. EU AI Act / GDPR / Saudi PDPL are extraterritorial (triggered by where *customers* are); UAE's DIFC Regulation 10 / ADGM rules are triggered by where the *company is registered* — both can apply to the same company at once, hence the `companies` schema split above. There is no single "UAE AI Act" — it's a layered regime (federal PDPL, DIFC Reg 10, ADGM DPR 2021, non-binding UAE AI Charter, plus a new Federal Authority for AI and Data as of June 2026). Saudi Arabia has AI-specific governance (SDAIA) separate from PDPL, and is still actively evolving (a live National AI Risk Management Framework plus a still-draft Responsible AI Policy) — re-verify before Gulf entry rather than trusting this as final.

## Current phase
**Phase 0/1** (thesis lock, five lens prompt design, Tender Readiness / AI Reliability / Data Protection research). Infrastructure setup is complete; no UI yet by design.

**Infrastructure — complete:**
- **Next.js 16** (App Router, TypeScript, Tailwind, `src/` dir) — builds and typechecks clean
- **Supabase**: full DB schema live on the new project (`pcnbekntpeqnacaaatkl` / DB name `elvanis-v2`), pushed via `supabase db push`. RLS scopes every company-owned table to `companies.user_id = auth.uid()`; a DB-level check constraint (`reports_sent_requires_reviewer`) enforces the mandatory review gate. `.env.local` has real `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (gitignored, not committed)
- **Groq**: `GROQ_API_KEY` set and verified live against `api.groq.com/openai/v1/models`; only reachable through `src/lib/ai-client`
- **GitHub**: repo pushed to [github.com/sallyabas/elvanis-v2](https://github.com/sallyabas/elvanis-v2), `main` branch, tracked
- **Email — both addresses confirmed working end-to-end** (real test sends received and checked, not just API 200s):
  - Supabase auth emails: custom SMTP configured via Resend's relay (`smtp.resend.com:465`, sender `noreply@app.elvanis.com`, sender name "Elvanis") — a live magic-link OTP send was received with the correct sender
  - Transactional email: `RESEND_FROM_EMAIL=info@app.elvanis.com`, domain verified in Resend (sending enabled) — a live test send was received with the correct sender
- Route skeleton: `src/app/(app)/{dashboard,business-profile,reports,account-settings}` and `src/app/(modules)/{tender-readiness,ai-reliability-audit,data-protection-compliance}` — placeholder pages only
- Lib skeleton: `src/lib/{lenses,evidence,reviewer,reports,modules}` — typed stubs that throw "not yet implemented," marking exactly what Phase 2 needs to fill in

**Lens prompt design — in progress (3 of 5 done):**
- **Financial** ([src/lib/lenses/financial.ts](src/lib/lenses/financial.ts)) — done, tested live against Groq incl. sparse/contradictory evidence. Benchmarks in `financial-benchmarks.ts` are founder-set starting points (gross margin, runway, customer concentration), explicitly provisional pending real pilot data.
- **Execution/Operating** ([src/lib/lenses/execution.ts](src/lib/lenses/execution.ts)) — done, tested. Benchmarks in `execution-benchmarks.ts` are externally published (DORA 2025, LinearB 2026, Agile IG/West Monroe decision-latency research, aggregated meeting-load surveys) since the founder has no first-hand thresholds for this domain yet — every figure is sourced, marked provisional.
- **AI & Governance** ([src/lib/lenses/ai-governance.ts](src/lib/lenses/ai-governance.ts)) — done, tested (questionnaire mode with/without live AI, document-review mode). Confirmed scope: this lens does NOT produce the AI Opportunity output (that's a separate cross-lens synthesis step, built later, per spec §2.3 step 6) and does NOT do formal EU AI Act conformity/risk classification (that's the standalone Tender Readiness module's job) — it only assesses AI governance maturity. Deliberately does not implement the shared `LensModule` interface — its input/output shape genuinely differs (mode branch, per-dimension maturity scores), and forcing it into the same interface as Financial/Execution would have been a worse abstraction than being honest it's shaped differently. See "AI & Governance architecture" below.
- **Commercial/Market, Product/Customer** — not started. Commercial is sequenced last because it needs external data lookup — different architecture from the pure evidence-in shape the other lenses share.

**Cross-lens patterns established (apply to all future lenses):**
- Shared schema lives in `src/lib/lenses/types.ts` (`LensFinding`, `GoalContext`, etc.) — don't reinvent per lens.
- `generateValidatedJson` (in `ai-client`) + a zod schema per lens is mandatory, not `generateJson`. Found live during Financial testing: Groq's `json_object` mode guarantees valid JSON but not conformance to our enums — it hallucinated `goalRelevance: "directly_affects"` (not a valid value) on two independent runs. Validation now fails loudly instead of letting bad data through.
- **Numeric benchmark comparisons are computed in code, never by the LLM** — this is now a closed-out fix, not an open risk. Testing found the model calling 96 hours "slower than industry average" against a 105.6-hour benchmark (96 < 105.6, actually faster) — a prompt-only "show your work" fix made the error auditable but did NOT reliably fix the model's own conclusion (still wrong in 2 of 3 runs). Fixed properly via `src/lib/lenses/metrics.ts`: lenses take a typed `metrics: MetricInput[]` array (metric key + raw value) alongside free-text `evidenceFields`; each lens's benchmarks file exports a `compare*Metric(key, value)` function that does the actual >, <, tier-lookup comparison deterministically, returning a `ComputedMetricComparison` with the comparison sentence already written correctly, injected into the prompt as a "COMPUTED BENCHMARK COMPARISONS — already calculated, do not recompute" block. The LLM's job is only to narrate implications, never judge direction/units itself. Re-tested the exact failing case (96h vs 105.6h) 4 times post-fix — correct every time. Applied to Financial (`compareFinancialMetric`) and Execution (`compareExecutionMetric`). One related bug caught in the same pass: when `evidenceFields` was empty, the prompt said "no evidence submitted" even when `metrics` had data — misled the model into an unwarranted "insufficient evidence" verdict. Fixed the wording to point at the computed-comparisons section instead.
- A lens must respect boundaries with sibling lenses (e.g. Financial must NOT diagnose *why* financial data is missing — that's Execution's operating-maturity-gap territory; Execution DOES own "no financial visibility"-type findings for exactly that reason). AI & Governance similarly must not duplicate Tender Readiness's deep AI Act work, and must not produce AI Opportunity output.
- **"Missing evidence is itself a finding, deterministically guaranteed when the condition is structural"** — pattern generalized from Financial to AI & Governance: if a specific known-risk combination exists (e.g. live AI in production + zero governance docs), don't just prompt the LLM to remember to flag it — inject the finding in code after generation, so it's never silently dropped. The LLM has been observed dropping findings non-deterministically across repeated runs (e.g. Execution occasionally omitted a PR-pickup-time finding even when the metric was provided) — do not rely on prompt instructions alone for anything that must always appear.

**AI & Governance architecture** ([src/lib/lenses/ai-governance-framework.ts](src/lib/lenses/ai-governance-framework.ts), [src/lib/lenses/ai-governance.ts](src/lib/lenses/ai-governance.ts)):
- 7-dimension maturity rubric (AI use inventory, risk classification awareness, human oversight, data governance for AI, vendor/model risk management, incident response & monitoring, governance ownership), each dimension scored 0-3, sourced from EU AI Act (4-tier risk classification, Art. 14 human oversight), NIST AI RMF (Govern/Map/Measure/Manage), ISO/IEC 42001 (management-system clauses), and OECD AI Principles (accountability) — externally researched per founder's direction, same treatment as Execution's benchmarks, explicitly provisional.
- Mode is decided by whether governance documents were submitted (`governanceDocsSubmitted`), per the original spec framing — NOT by whether the company has live AI in production. `hasLiveAiInProduction` is captured as an independent signal regardless of mode.
- **Questionnaire mode** (no docs): dimension scores are supplied by the client/reviewer and looked up deterministically in code (`scoreDimension`) — fully deterministic, same pattern as `metrics.ts`.
- **Document-review mode** (docs submitted): the LLM can't be handed a pre-computed score since the evidence is unstructured documents — but its role is narrowed to a classification task (pick the 0-3 integer whose rubric description best matches the evidence), not free-form scoring. The canonical level-description text is still always looked up in code from that integer, never generated by the model. Overall maturity aggregation (`computeOverallMaturity`) is the same deterministic function in both modes.
- `dimensionScores` (all 7, always) is returned separately from `findings` (LLM-curated, may not cover every weak dimension) — so a reviewer never loses visibility into a zero-scored dimension even when the LLM's prose findings didn't call it out.

**Not yet done:**
- No infrastructure blockers. Remaining lens prompts: Commercial/Market, Product/Customer.

## Working style
- Think like a CTO: scalability, dependencies, business impact — not just "does it run."
- Don't over-build ahead of proof. Exception: modules built from external research (Tender Readiness, AI Reliability, Data Protection) don't need a live client first — they're sequenced by engine-readiness, not by demand signal.
- Keep this file current. When real decisions get made or change in future sessions, update this file — don't let it go stale relative to the spec doc or actual code.
