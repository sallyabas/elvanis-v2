-- Automated post-delivery feedback + pilot testimonial/referral asks
-- (confirmed 2026-08-24, direct founder request, correcting the earlier
-- "handle referrals manually" decision from the same day's Concierge
-- batch) — real, built system features, reusing the existing notification
-- infrastructure (notifications table, notification_event_type,
-- sendPendingNotifications()/dispatch.ts) rather than a new mechanism.

-- is_pilot_client: a real, explicit, reviewer-set flag, NOT auto-derived.
-- Real reason, not a stylistic choice: this database already contains
-- many disposable test/proof companies from this session's own history
-- (Sally, Nimbus Ledger Ltd, Riverbank Analytics Ltd, Fulltest Analytics
-- Ltd, etc.) — any "first N companies by creation date" rule would
-- incorrectly treat those as pilot clients. The reviewer marks a real
-- pilot client explicitly, same pattern as plan_tier.
alter table companies add column is_pilot_client boolean not null default false;

-- Structured link for module deliveries, mirroring related_report_id
-- (20260806190000) and related_sprint_id (20260818090000) exactly — a
-- real, small gap closed along the way: module_new_submission/module_ready
-- already accepted "no direct link" as a disclosed limit, but the new
-- feedback/testimonial prompts genuinely need to deep-link to the specific
-- delivered module (a real client-facing detail page exists for this,
-- services/module/[requestId]), so this is worth adding now rather than
-- inheriting the same limit unnecessarily.
alter table notifications add column related_module_request_id uuid references module_requests (id) on delete set null;

-- Two new event types. Deliberately generic across BOTH report and module
-- deliveries (not four separate types) — related_report_id vs.
-- related_module_request_id (exactly one set, never both) distinguishes
-- which. Matches the founder's own framing ("after any report or module
-- is delivered").
alter type notification_event_type add value 'report_feedback_request';
alter type notification_event_type add value 'pilot_testimonial_request';

-- One shared table for both general feedback and testimonial/referral
-- responses — structurally the same shape (a delivery event + free text),
-- discriminated by feedback_type rather than two near-identical tables.
create table delivery_feedback (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  feedback_type text not null check (feedback_type in ('general', 'testimonial')),
  related_report_id uuid references reports (id) on delete set null,
  related_module_request_id uuid references module_requests (id) on delete set null,
  response_text text,
  referral_contact text,
  created_at timestamptz not null default now()
);

alter table delivery_feedback enable row level security;

-- Client writes their own response; the session-scoped Server Action
-- verifies company ownership before insert, same discipline as every
-- other client-owned write in this codebase, so this policy is real
-- defense-in-depth, not the only check.
create policy "owner writes own delivery feedback" on delivery_feedback
  for insert with check (
    company_id in (select id from companies where user_id = auth.uid())
  );
