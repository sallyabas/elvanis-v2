-- "Having trouble? Contact us" (confirmed 2026-09-05, direct founder
-- request) — a genuinely new, dedicated capture path, distinct in kind
-- from session_requests (no scheduling lifecycle fits "someone is
-- stuck, please help them") and from the plain mailto: link already on
-- the landing page/footer (which collects nothing, tracks nothing).
-- Same lightweight, no-RLS, admin-client-only pattern already used for
-- idea_backlog/finding_feedback — genuinely internal-only until a
-- session-scoped read is ever needed, which it isn't here.
create type contact_request_status as enum ('open', 'resolved');

create table contact_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete set null,
  name text not null,
  email text not null,
  message text,
  -- Nullable/"General" rather than forced to name one of the five paid
  -- services (confirmed 2026-09-05) — Evidence Intake is a 5th placement
  -- alongside the 3 module intakes and /services, and it isn't itself
  -- one of the named paid services, so forcing a value there would be
  -- dishonest structured data.
  service_context text,
  status contact_request_status not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter type notification_event_type add value 'contact_request_submitted';
