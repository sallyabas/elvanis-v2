-- Fix module_requests RLS gap properly at the schema/policy level (confirmed
-- 2026-08-06) — not left as an app-layer-only workaround, given real client
-- data now flows through all three standalone modules.
--
-- Real gap, previously flagged but not fixed: `module_requests`' original
-- policy (`for all using (company_id in ...)`) let the owning client read
-- (and, in principle, write) a row in ANY status — draft/pending_review/
-- approved/sent — unlike `reports`' own client-facing policy, which is
-- correctly restricted to `for select ... and status = 'sent'`. Reports &
-- History (src/app/(app)/reports/page.tsx) already filters to `sent` at the
-- APPLICATION level for consistency with "only visible once actually
-- delivered," but the underlying RLS policy itself was never brought in
-- line — meaning a client session querying Supabase directly (not through
-- that page) could read pending_review/approved module data before it was
-- meant to be visible.
--
-- Safe to tighten: confirmed by reading every write site
-- (src/lib/modules/*/persist.ts, src/lib/reviewer/module-workspace.ts) —
-- every single write to module_requests/module_findings/procurement_answers
-- already goes through the admin/service-role client, which bypasses RLS
-- entirely. The session-scoped RLS policy is only ever exercised for
-- reads, so restricting it to `select` + `status = 'sent'` closes the real
-- gap without breaking anything that actually relies on broader access.

-- Same gap, same fix, in the two tables that hang off module_requests by
-- request_id rather than company_id directly — found while fixing the
-- table above, not anticipated upfront. module_findings holds the actual
-- diagnostic content (a client shouldn't see it before reviewer approval +
-- delivery, same as lens_findings for the core audit); procurement_answers
-- is Tender Readiness-specific draft Q&A with the identical concern. Both
-- already only ever get written via the admin client (confirmed by reading
-- every write site), so tightening to `sent`-gated select-only is safe here
-- too.

drop policy "owner reads own module requests" on module_requests;

create policy "owner reads own sent module requests" on module_requests
  for select using (
    company_id in (select id from companies where user_id = auth.uid())
    and status = 'sent'
  );

drop policy "owner reads own module findings" on module_findings;

create policy "owner reads own sent module findings" on module_findings
  for select using (
    request_id in (
      select mr.id from module_requests mr
      join companies c on c.id = mr.company_id
      where c.user_id = auth.uid() and mr.status = 'sent'
    )
  );

drop policy "owner reads own procurement answers" on procurement_answers;

create policy "owner reads own sent procurement answers" on procurement_answers
  for select using (
    request_id in (
      select mr.id from module_requests mr
      join companies c on c.id = mr.company_id
      where c.user_id = auth.uid() and mr.status = 'sent'
    )
  );
