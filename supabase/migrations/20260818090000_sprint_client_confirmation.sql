-- Real gap found and closed (confirmed 2026-08-18, direct founder question):
-- a reviewer selecting a finding and creating an Execution Sprint had ZERO
-- client confirmation step — createSprintFromFinding() immediately drafted
-- tasks, and approveSprintTasks() flipped the sprint straight from
-- 'scoped' to 'in_progress', fully client-visible and already started,
-- with no notification even fired at proposal time. Confirmed by reading
-- the actual code (execution-sprint/workspace.ts, the client-facing page's
-- 'scoped' holding branch) before building anything, per the standing
-- "report current behavior, then implement if the gap is confirmed" rule.
--
-- Fixed with a new leading stage: 'proposed' (reviewer picked a finding,
-- no tasks drafted yet, client must confirm or reselect) precedes
-- 'scoped' (which keeps its existing meaning — tasks AI-drafted, awaiting
-- the reviewer's Accept/Edit/Reject pass). The reviewer still does all the
-- real task-scoping work, only after the client has confirmed which
-- finding it should be about.
alter type sprint_status add value 'proposed' before 'scoped';

-- Real, disclosed point-in-time marker, same pattern as signed_off_at/
-- delivered_at/approved_at elsewhere in this codebase — when the client
-- actually confirmed (or reselected), distinct from created_at (when the
-- reviewer proposed it) and start_date (when the reviewer's task plan was
-- itself approved).
alter table execution_sprints add column confirmed_at timestamptz;

-- Client-facing — fires the moment a reviewer proposes a sprint, so the
-- client actually finds out there's something to confirm rather than
-- discovering it silently already in progress.
alter type notification_event_type add value 'sprint_proposed';

-- Real, structured link column, same precedent as reports.related_report_id
-- (added for report_ready/re_audit_reminder so those emails link to the
-- exact report rather than guessing "most recent") — lets the
-- sprint_proposed email link directly to the specific proposed sprint.
alter table notifications add column related_sprint_id uuid references execution_sprints (id);
