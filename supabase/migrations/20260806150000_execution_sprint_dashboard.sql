-- Execution Sprint Dashboard (confirmed 2026-08-06) — the paid £3,000
-- implementation engagement: a bounded 2-4 week effort to fix ONE
-- specific finding from an approved audit. Not a dev/Agile sprint, not an
-- ongoing management relationship — a defined, time-boxed deliverable.
-- Full confirmed design (locked plan, change-request notes, deterministic
-- KPI-deviation alerts, client signoff, reviewer commentary as the final
-- report) is in CLAUDE.md. Real gap this closes: the spec doc's own V2
-- detail section already said this was "moved to V1 — needed to actually
-- deliver the paid Execution Sprint, a real revenue offer" — that
-- decision had gone unbuilt and unnoticed until re-checked against the
-- primary doc.

-- execution_sprints: signoff + final-report + activity-tracking columns.
alter table execution_sprints add column signed_off_at timestamptz;
alter table execution_sprints add column reviewer_commentary text;
alter table execution_sprints add column last_client_activity_at timestamptz;

-- sprint_tasks: replace free-text KPI fields with structured numeric ones
-- — a genuinely deterministic deviation check (confirmed 2026-08-06) needs
-- numbers and a direction, not a parse of arbitrary prose, which this
-- codebase's standing rule already avoids elsewhere. Table has zero rows
-- (never wired to any app code until now), so dropping the old text
-- columns needs no backfill. Also adds the AI-draft/mandatory-review
-- columns — same ai_draft/reviewer_status pattern already used by
-- lens_findings/module_findings, reusing the shared reviewer_status enum.
alter table sprint_tasks drop column kpi_target;
alter table sprint_tasks drop column kpi_actual;
alter table sprint_tasks add column kpi_description text;
alter table sprint_tasks add column kpi_target_value numeric;
alter table sprint_tasks add column kpi_actual_value numeric;
alter table sprint_tasks add column kpi_direction text check (kpi_direction in ('higher_is_better', 'lower_is_better'));
alter table sprint_tasks add column ai_draft jsonb;
alter table sprint_tasks add column reviewer_status reviewer_status not null default 'draft';

-- Change-request notes and KPI-deviation alerts share ONE mechanism
-- (confirmed 2026-08-06: "same mechanism as the plan-change notes,
-- different trigger") — the note/alert IS the log; no separate audit
-- table, no dedicated flagging engine. Backs a reviewer-facing panel on
-- /queue, same list+reply pattern as Session Requests/Regulatory Content.
create table sprint_queue_items (
  id uuid primary key default gen_random_uuid(),
  execution_sprint_id uuid not null references execution_sprints (id) on delete cascade,
  sprint_task_id uuid references sprint_tasks (id) on delete cascade,
  trigger_type text not null check (trigger_type in ('client_note', 'kpi_deviation')),
  note text,
  status text not null default 'open' check (status in ('open', 'resolved')),
  reviewer_reply text,
  resolved_by uuid references users (id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index on sprint_queue_items (execution_sprint_id);
create index sprint_queue_items_open_idx on sprint_queue_items (status) where status = 'open';

alter table sprint_queue_items enable row level security;
create policy "owner reads own sprint queue items" on sprint_queue_items
  for select using (
    execution_sprint_id in (
      select id from execution_sprints where company_id in (
        select id from companies where user_id = auth.uid()
      )
    )
  );

-- Tighten execution_sprints/sprint_tasks RLS from `for all` to `for select`
-- (confirmed 2026-08-06) — same class of gap already found and fixed for
-- module_requests: real client-editable writes now flow through this
-- schema (task status, KPI actuals), and Postgres RLS is row-level only,
-- not column-level, so it can never enforce "status/kpi_actual_value are
-- editable but task_description/owner/target/due_date are locked" on its
-- own. That lock is enforced in the server actions (admin client, explicit
-- field whitelist), not by giving the client's own session broader write
-- access than it should ever need.
drop policy "owner reads own execution sprints" on execution_sprints;
create policy "owner reads own execution sprints" on execution_sprints
  for select using (company_id in (select id from companies where user_id = auth.uid()));

drop policy "owner reads own sprint tasks" on sprint_tasks;
create policy "owner reads own sprint tasks" on sprint_tasks
  for select using (
    execution_sprint_id in (
      select id from execution_sprints where company_id in (
        select id from companies where user_id = auth.uid()
      )
    )
  );

-- Deviation threshold, admin-adjustable (confirmed 2026-08-06, same
-- pattern as every other benchmark in this build) — seeded at 20% as a
-- starting default per explicit direction, not guessed with no basis.
insert into app_settings (key, value) values ('kpi_deviation_threshold_percent', '20');

-- sprint_queue_item: reviewer alert (new client note or KPI deviation).
-- sprint_signed_off: reviewer alert (client signed off, needs commentary).
-- sprint_reply: client-facing, sent IMMEDIATELY on reviewer reply (not the
-- standard log-then-cron-dispatch pattern every other event uses) —
-- confirmed 2026-08-06: this is the one case where the up-to-15-minute
-- cron delay matters more than pattern consistency, since it's a direct
-- reply to a client waiting on a struggling-KPI question.
alter type notification_event_type add value 'sprint_queue_item';
alter type notification_event_type add value 'sprint_signed_off';
alter type notification_event_type add value 'sprint_reply';