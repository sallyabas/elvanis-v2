-- Tender Readiness's procurement-answer generator (confirmed 2026-08-04,
-- Priority 3) — flagged earlier as a real open design question, not a
-- build task, since the spec's own reference sources (Verumt, Flutteris,
-- Legalithm) were never actually researched. Resolved: research done
-- separately (couldn't find those exact formats, but found strong,
-- cross-source-validated real question categories that multiple
-- independent 2026 AI procurement frameworks converge on).
--
-- Deliberately its own table, not folded into `module_findings` — a real
-- Q&A pair (category/question/answer/regulations cited) is a genuinely
-- different shape than a diagnosis/rootCause/recommendedAction/severity
-- finding, same "reuse the review mechanism, don't force the findings
-- shape" principle already used for module_findings itself. Reuses the
-- exact same `reviewer_status` enum and immutable-ai_draft-vs-
-- reviewer_edited pattern.
--
-- Generated from reviewer-APPROVED findings only, same reasoning already
-- established for AI Opportunity Synthesis ("synthesizing from findings
-- that might still get edited/rejected would build on sand") — enforced
-- in code (generateProcurementAnswers only proceeds if the request is
-- approved/sent), not by a DB constraint, since module_requests' own
-- status already gates this the same way it gates report_ready.

create table procurement_answers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references module_requests (id) on delete cascade,
  category text not null,
  question text not null,
  ai_draft_answer text not null,
  regulations_cited text[] not null default '{}',
  reviewer_status reviewer_status not null default 'draft',
  reviewer_edited_answer text,
  reviewer_notes text,
  created_at timestamptz not null default now()
);

alter table procurement_answers enable row level security;

create policy "owner reads own procurement answers" on procurement_answers
  for all using (
    request_id in (
      select mr.id from module_requests mr
      join companies c on c.id = mr.company_id
      where c.user_id = auth.uid()
    )
  );
