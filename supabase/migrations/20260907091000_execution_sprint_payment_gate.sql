-- Execution Sprint payment gate (confirmed 2026-09-07, direct founder
-- spec) — closes a real, confirmed gap of the exact same class already
-- fixed for the core audit and the three standalone modules:
-- confirmSprintFinding() ran a real, synchronous Groq call (task
-- drafting) with zero payment check. Task drafting now only ever runs
-- once a reviewer marks a sprint request paid.
--
-- selected_finding_id must become nullable: a "Let Elvanis decide"
-- request has no finding chosen yet at request time — the reviewer picks
-- one afterwards, independent of payment.
alter table execution_sprints alter column selected_finding_id drop not null;

-- Same shape as module_payment_status, deliberately — pending/processing/
-- paid/unpaid, with 'processing' as the real atomic-claim lock (see
-- module-payment-gate.ts's own docblock for why payment_status, not
-- sprint_status itself, carries the lock: sprint_status must stay at its
-- pre-task-drafting value throughout the real Groq call, since flipping
-- it early would make a genuinely-failed draft indistinguishable from a
-- genuinely-empty one).
create type sprint_payment_status as enum ('pending', 'processing', 'paid', 'unpaid');
alter table execution_sprints add column payment_status sprint_payment_status not null default 'pending';

-- Real, distinct request origin (confirmed 2026-09-07) — "I'll choose the
-- finding myself" vs "Let Elvanis decide," a genuinely new client-facing
-- choice. Nullable: the pre-existing reviewer-proactive proposeSprintFinding()
-- path (kept, unchanged, alongside these two new client-initiated ones)
-- sets neither — it's a third, older origin this field doesn't need to
-- describe.
alter table execution_sprints add column choice_mode text check (choice_mode in ('client_chosen', 'elvanis_chooses'));

-- New leading stage, before 'proposed' — a sprint request now sits here
-- (finding possibly not yet chosen, for 'elvanis_chooses' requests) until
-- a reviewer marks it paid, at which point task drafting runs and it
-- becomes 'scoped' (same meaning as today: tasks drafted, awaiting the
-- reviewer's own Accept/Edit/Reject pass) — 'proposed'/'scoped' keep
-- their existing meaning for the older reviewer-proactive flow, which
-- ALSO now routes through 'awaiting_payment' before task drafting (see
-- workspace.ts).
alter type sprint_status add value 'awaiting_payment' before 'proposed';
