-- Entry-path routing (confirmed 2026-08-27, Onboarding Architecture &
-- Path Routing brief, Part 8b) — the post-signup "what brings you here
-- today?" screen writes exactly one of three values here, once, on first
-- login after signup. Nullable, not `not null default`: null means "the
-- routing screen hasn't been shown/answered yet" (a real, distinct state
-- from `undecided`, which is a genuine recorded choice — "show me both
-- options" — not the same as "never asked"). The app layer, not this
-- column, decides whether to show the routing screen (it shows whenever
-- entry_path is null).
--
-- Deliberately stays a plain text + CHECK column, not a Postgres enum —
-- matches this codebase's own established precedent for exactly this
-- shape (session_requests.session_type, business_model is the one real
-- enum exception) since a CHECK constraint is far cheaper to widen later
-- than a Postgres enum type.
alter table companies
  add column entry_path text check (entry_path in ('diagnosis', 'ai_audit', 'undecided'));

comment on column companies.entry_path is
  'Post-signup routing choice: diagnosis (Path A), ai_audit (Path B), or undecided (Hub). Null = the routing screen has not been shown/answered yet. Editable later from Account Settings, but changing it never retroactively alters delivered reports.';
