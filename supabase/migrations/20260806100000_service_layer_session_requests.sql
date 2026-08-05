-- Service Layer: Discovery/Delivery Session, Concierge tier, F2F Workshop
-- (confirmed 2026-08-06, spec §1.5/§1.9/§1.9a) — real, buildable-now scope
-- given no payment provider or calendar integration exists anywhere in
-- this codebase (confirmed by grep before writing this). These sessions
-- cannot be self-serve-booked or paid for yet, so this is deliberately a
-- request + human-follow-up mechanism, same pattern already used
-- throughout this codebase (re-audit reminders, evidence-completeness
-- nudges: log a real row, notify a human, real send is a separate step) —
-- NOT a fake calendar/payment flow that doesn't actually connect to
-- anything real.

create table session_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  session_type text not null check (session_type in ('discovery', 'delivery', 'f2f_workshop')),
  status text not null default 'requested' check (status in ('requested', 'scheduled', 'completed', 'declined')),
  client_notes text,
  reviewer_notes text,
  requested_at timestamptz not null default now(),
  scheduled_at timestamptz,
  completed_at timestamptz
);

create index on session_requests (company_id);

alter table session_requests enable row level security;

create policy "owner reads/writes own session requests" on session_requests
  for all using (
    company_id in (select id from companies where user_id = auth.uid())
  );

-- No new report_status/reviewer_status enum values needed — session_requests
-- has its own small status vocabulary, genuinely distinct from the
-- review-gate vocabulary those enums exist for.
