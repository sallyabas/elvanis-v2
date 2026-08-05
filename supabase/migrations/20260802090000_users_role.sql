-- Reviewer authentication (confirmed 2026-08-02) — the Reviewer Queue/
-- Workspace routes have had zero access control since they were built
-- (see the layout's own banner). Pilot companies' real data is about to
-- touch this system, so this is a precondition for launch, not a feature.
--
-- A user is either a 'client' or a 'reviewer', not both — matches the
-- existing "one company per account" / single-role-per-person design
-- language rather than introducing a separate roles/permissions table for
-- what is currently a two-value distinction.
--
-- Granting reviewer access is a data change (see scripts/grant-reviewer.ts),
-- never a code change — no reviewer email is ever hardcoded in the app.

alter table users
  add column role text not null default 'client';

alter table users
  add constraint users_role_check check (role in ('client', 'reviewer'));

comment on column users.role is
  'client or reviewer — see scripts/grant-reviewer.ts to grant reviewer access. A user is one or the other, never both.';
