-- Concierge tier build (confirmed 2026-08-24, direct founder request), two
-- schema pieces:

-- 1. "Contact Sales" request reuses the EXISTING session_requests
-- mechanism (same table, same reviewer queue panel, same notification
-- pipeline) rather than building a new one — a new session_type value,
-- not a new table. session_type is a plain text column with a CHECK
-- constraint (not a Postgres enum), so this is a drop-and-recreate of
-- that constraint.
alter table session_requests drop constraint session_requests_session_type_check;
alter table session_requests add constraint session_requests_session_type_check
  check (session_type in ('discovery', 'delivery', 'f2f_workshop', 'concierge_inquiry'));

-- 2. Reviewer-authored notes attached to a specific finding (confirmed
-- 2026-08-24) — genuinely new, not reused from an existing pattern.
-- Deliberately its own table, not a column on lens_findings: this is
-- content added by a human, potentially well after report delivery (from
-- a real Discovery/Delivery call), distinct in kind from the
-- ai_draft/reviewer_edited_content lifecycle lens_findings already has.
-- One active note per finding (not a comment thread) — the tangible
-- single artifact the founder described, not a running log; easy to
-- expand later if a real need for multiple notes per finding emerges.
--
-- author_name is captured per-note, not read from a global reviewer
-- profile setting — users.name exists on the schema but is null for
-- every real reviewer account today, and no reviewer-facing settings
-- page exists to set it. Capturing the name at note-authoring time is
-- honest for a future multi-reviewer scenario (this specific note really
-- was written by whoever typed their name in that moment) without
-- building new settings infrastructure this pass didn't ask for.
create table finding_concierge_notes (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null unique references lens_findings (id) on delete cascade,
  reviewer_id uuid not null references users (id),
  author_name text not null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table finding_concierge_notes enable row level security;

-- Client-facing read, same "owner reads via the finding's own chain of
-- ownership" pattern already used elsewhere in this schema. Every write
-- goes through the admin client after a reviewer session+role check
-- (same discipline as every other reviewer Server Action), so this
-- policy only needs to cover the client-facing read path.
create policy "owner reads own finding's concierge note" on finding_concierge_notes
  for select using (
    finding_id in (
      select lf.id from lens_findings lf
      join reports r on r.id = lf.report_id
      join companies c on c.id = r.company_id
      where c.user_id = auth.uid() and r.status = 'sent'
    )
  );
