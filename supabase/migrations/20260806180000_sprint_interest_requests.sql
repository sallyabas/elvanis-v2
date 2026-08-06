-- Client-facing Execution Sprint interest (confirmed 2026-08-06, honest UX
-- review pass) — closes a real gap found while reviewing the delivered
-- report: Execution Sprint has no client-visible entry point anywhere, so a
-- client reading their #1 priority has no way to signal they want help
-- implementing it. Sprint creation itself stays reviewer-triggered (no
-- in-app checkout exists — payment is confirmed externally first, same
-- pattern as Concierge/F2F Workshop), but the client needs a visible path
-- to REQUEST it. Deliberately its own small table, not folded into
-- session_requests — that table models scheduling a live call
-- (scheduled_at/completed_at), and this isn't a call request, it's
-- interest in a specific finding tied to a specific report.
create table sprint_interest_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  report_id uuid not null references reports (id) on delete cascade,
  finding_id uuid not null references lens_findings (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'resolved')),
  client_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references users (id)
);
create index on sprint_interest_requests (company_id);
create index sprint_interest_requests_open_idx on sprint_interest_requests (status) where status = 'open';

alter table sprint_interest_requests enable row level security;

-- Simple client-initiated request, no locked/restricted fields to protect
-- (unlike sprint_tasks, which needed field-level write locking enforced at
-- the server-action layer) — the session-scoped client can insert and read
-- its own rows directly, same as most other client-owned tables.
create policy "owner reads own sprint interest requests" on sprint_interest_requests
  for select using (company_id in (select id from companies where user_id = auth.uid()));
create policy "owner inserts own sprint interest requests" on sprint_interest_requests
  for insert with check (company_id in (select id from companies where user_id = auth.uid()));

alter type notification_event_type add value 'sprint_interest_requested';
