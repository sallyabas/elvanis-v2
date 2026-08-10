-- Delayed-execution architecture (confirmed 2026-08-10, direct founder
-- request following a real architecture question) — closes a real,
-- confirmed bug: submitEvidence() was calling runAudit() immediately and
-- synchronously on every submission, including every resubmission during
-- the supposed 24h "edit window." That meant "editing" never updated
-- anything in place — it silently created a brand-new report and re-ran
-- all five lenses (real Groq cost) on every resubmission, exactly the
-- wrong behavior for a window whose entire premise is "you can keep
-- revising before anything runs." Confirmed via direct code read (see
-- run-audit.ts / evidence-intake/actions.ts), not assumed.
--
-- This table is the new source of truth for evidence BEFORE the audit
-- runs. Resubmitting during the window updates this same row in place —
-- no new row, no Groq call. A new cron check (see run-pending-audits.ts)
-- picks up rows whose window has closed and runs the audit exactly once,
-- using whatever evidence is on record at that moment.
create type pending_evidence_submission_status as enum ('editing', 'audit_in_progress', 'completed');

create table pending_evidence_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  goal_id uuid references goals (id) on delete set null,
  -- Same shape as reports.source_evidence_snapshot — {financial, execution,
  -- product, commercial, aiGovernance} — deliberately reused rather than a
  -- new shape, so runAudit() (unchanged) takes the same input either way.
  evidence_payload jsonb not null,
  status pending_evidence_submission_status not null default 'editing',
  -- Anchored once, at first submission — NOT reset on every edit. If this
  -- were bumped forward on each resubmit, a client could indefinitely
  -- extend the window by editing every 23 hours, defeating the SLA.
  submitted_at timestamptz not null default now(),
  edit_window_closes_at timestamptz not null,
  -- "Queued for audit" is a DERIVED display state (status still 'editing'
  -- but edit_window_closes_at has passed) — not a persisted value. Deriving
  -- it means the client/reviewer UI is accurate the instant the window
  -- closes, not only after the next cron tick gets around to flipping a
  -- column (up to ~20 minutes of lag on the GitHub Actions cadence). See
  -- submission-status.ts.
  --
  -- last_attempted_at supports a real, deliberately simple stale-retry
  -- mechanism: if a tick marks a row 'audit_in_progress' and then the
  -- process crashes/errors before completion, the row would otherwise be
  -- stuck forever. A later tick re-picks up any 'audit_in_progress' row
  -- whose last_attempted_at is older than a short threshold. No
  -- dead-letter queue or max-retry cap in this pass — a deliberate scope
  -- decision, not an oversight (flagged in run-pending-audits.ts).
  last_attempted_at timestamptz,
  resulting_report_id uuid references reports (id) on delete set null,
  created_at timestamptz not null default now()
);

-- At most one ACTIVE (not yet completed) submission per company —
-- resubmitting during the window updates this same row; a genuinely new
-- cycle can only start once the prior one is 'completed' (its own report
-- exists). Partial index, not a plain unique column, so completed rows
-- stay as real history without blocking the next cycle.
create unique index pending_evidence_submissions_one_active_per_company
  on pending_evidence_submissions (company_id)
  where status <> 'completed';

alter table pending_evidence_submissions enable row level security;

-- Read-only for the owner — every write in this app's evidence-intake
-- path goes through the admin client after session-based ownership
-- verification (same pattern submitEvidence() already used before this
-- change), so this policy exists for defense-in-depth/consistency with
-- every other company-owned table in this schema, not because any code
-- path actually queries this table with the session client today.
create policy "owner reads own pending submission" on pending_evidence_submissions
  for select using (
    company_id in (select id from companies where user_id = auth.uid())
  );
