-- Module payment gate (confirmed 2026-09-06, direct founder decision) —
-- closes a real, confirmed gap: none of the three paid modules (Tender
-- Readiness £2,500, AI Reliability Audit £2,000, Data Protection
-- Compliance £2,000) had any check of any kind — not payment, not even
-- company-ownership re-verification — before running a real, synchronous
-- Groq call. Every submission ran the full analysis unconditionally.
--
-- 'awaiting_payment' is a real, new value on report_status (the same
-- enum module_requests.status already reuses from reports) — a module
-- request now starts here, with NO findings yet, and only advances to
-- 'pending_review' (today's original starting point) once a reviewer
-- confirms payment and the real analysis actually runs. Deliberately a
-- real enum value, not a repurposed 'draft' — 'draft' reads as "not yet
-- submitted," which this genuinely isn't; a misleading value here would
-- cost a future reader real confusion for zero migration savings.
alter type report_status add value 'awaiting_payment';

-- Confirmed decision, not the earlier-scoped simpler pending/paid pair:
-- a real third outcome, 'unpaid' — the reviewer can explicitly say "I
-- checked, this hasn't been paid" (a real, visible client-facing status),
-- distinct from "haven't checked yet." Genuinely revisable, not a dead
-- end: a reviewer can move an 'unpaid' row to 'paid' later once payment
-- actually arrives, same claim mechanism either way.
--
-- 'processing' is the real, load-bearing atomic-claim guard, not
-- decoration — a reviewer's "Mark as paid" click now runs a genuine
-- synchronous Groq call inline (no cron to hand it off to, unlike the
-- core audit's re-audit gate), so two near-simultaneous clicks on the
-- same request must not both run the analysis and double-insert
-- findings. The claim UPDATE moves pending/unpaid -> processing
-- atomically; success moves it to 'paid', failure reverts it to
-- 'pending' (never back to 'unpaid' — a failed Groq call says nothing
-- about whether payment was received, so reverting to 'unpaid' would
-- misrepresent the failure as a payment determination).
create type module_payment_status as enum ('pending', 'processing', 'paid', 'unpaid');

alter table module_requests
  add column payment_status module_payment_status not null default 'pending';

-- No idempotency-guard timestamp needed here the way
-- pending_evidence_submissions.payment_notified_at was for the core
-- audit's re-audit gate — that one exists because a cron tick
-- re-discovers the same due row every ~20 minutes and must not
-- re-notify every time. Modules have no cron dependency at all: the
-- admin notification fires exactly once, synchronously, inside the same
-- request that creates the row — there is no repeated-discovery moment
-- to guard against.
