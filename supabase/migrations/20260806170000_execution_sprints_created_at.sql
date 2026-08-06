-- Real bug found live 2026-08-06: the reviewer queue's "Execution Sprint
-- (task review)" panel selects execution_sprints.created_at to sort/display
-- newly-scoped sprints, but the original schema never gave execution_sprints
-- a created_at column at all (unlike most other tables). Caught via a real
-- "column does not exist" error on the actual /queue page, not caught by
-- tsc/build since Supabase's generated types aren't statically checked here.
alter table execution_sprints add column created_at timestamptz not null default now();
