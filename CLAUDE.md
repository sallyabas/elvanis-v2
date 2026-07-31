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

## Modules built in V1 (research-driven, not client-trigger-gated)
Built on the shared core engine (evidence intake, reviewer workspace, report generator) once it's stable — not before, not in parallel:
- **Tender Readiness** — AI Act risk classification, procurement questionnaire prep
- **AI Reliability Audit** — adversarial testing against documented real-world AI failure patterns
- **Data Protection Compliance** — GDPR first (current UK/NL market), PDPL extension deferred until Gulf entry is real

Each has its own intake, findings schema, report template, and standalone entry page.

## Information architecture — four separate pages, not one
- **Account Settings** — the person (name/email/password/notifications/billing)
- **Business Profile** — the company being diagnosed (living record every lens reads from)
- **Reports & History** — chronological, frozen-snapshot archive of every generated report
- **Dashboard** — current live state (latest top-3, roadmap status, active sprint)

## Database schema
Full schema is in §3 of the spec doc. Core tables: `users`, `companies`, `company_profile_history`, `digital_presence_scans`, `goals`, `evidence_submissions`, `evidence_files`, `evidence_fields`, `lens_findings`, `financial_impact_estimates`, `ai_governance_detail`, `ai_opportunity_synthesis`, `readiness_scores`, `priority_ranking`, `finding_conflicts`, `reports`, `notifications`, `execution_sprints`, `sprint_tasks`, `scheduled_jobs`, `case_library`, `monthly_retainers` (V3), `export_source_signatures`, `tender_readiness_requests`, `ai_reliability_requests`, `data_protection_requests`.

## Current phase
**Phase 0/1** (thesis lock, five lens prompt design, Tender Readiness / AI Reliability / Data Protection research). No UI yet by design.

**Scaffold status (done):**
- Next.js 16 (App Router, TypeScript, Tailwind, `src/` dir) — builds and typechecks clean
- Full DB schema live on the new Supabase project (`pcnbekntpeqnacaaatkl` / DB name `elvanis-v2`), pushed from `supabase/migrations/20260731090054_init_schema.sql` via `supabase db push`. RLS policies scope every company-owned table to `companies.user_id = auth.uid()`; a DB-level check constraint (`reports_sent_requires_reviewer`) enforces the mandatory review gate. Verified live: `supabase migration list` shows local/remote in sync, and an anon REST call against `companies` returns `200 []` (table exists, RLS correctly hides rows from unauthenticated access)
- `.env.local` populated with `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` (real values — not committed, gitignored)
- `src/lib/supabase/{client,server,admin,proxy}.ts` — browser/server/service-role clients + session-refresh proxy (Next 16 renamed `middleware.ts` → `proxy.ts`)
- `src/lib/ai-client/` — provider abstraction (`generateText`/`generateJson`) wrapping Groq via `groq-sdk`; provider/model chosen in `config.ts` from `AI_PROVIDER`/`AI_MODEL` env vars; only file allowed to import a provider SDK
- Route skeleton: `src/app/(app)/{dashboard,business-profile,reports,account-settings}` and `src/app/(modules)/{tender-readiness,ai-reliability-audit,data-protection-compliance}` — placeholder pages only
- Lib skeleton: `src/lib/{lenses,evidence,reviewer,reports,modules}` — typed stubs that throw "not yet implemented," marking exactly what Phase 2 needs to fill in
- Local git repo initialized (not yet pushed to a GitHub remote)

**Not yet done / blocked on you:**
- No GitHub remote yet — local repo only
- `GROQ_API_KEY` / `RESEND_API_KEY` / `RESEND_FROM_EMAIL` not yet set in `.env.local`

## Working style
- Think like a CTO: scalability, dependencies, business impact — not just "does it run."
- Don't over-build ahead of proof. Exception: modules built from external research (Tender Readiness, AI Reliability, Data Protection) don't need a live client first — they're sequenced by engine-readiness, not by demand signal.
- Keep this file current. When real decisions get made or change in future sessions, update this file — don't let it go stale relative to the spec doc or actual code.
