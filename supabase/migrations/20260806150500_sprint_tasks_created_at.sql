-- Real gap caught while building the reviewer task-review page for
-- Execution Sprints: sprint_tasks never had a created_at column, so there
-- was no correct way to preserve the AI's proposed task ordering on
-- display — following the earlier 20260806150000 migration once it was
-- already applied, not folded back into it.
alter table sprint_tasks add column created_at timestamptz not null default now();
