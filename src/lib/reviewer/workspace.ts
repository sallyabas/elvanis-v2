// Reviewer workspace — the mandatory human validation gate. A report can
// never reach `sent` without passing through here (enforced at the DB level
// too, see reports_sent_requires_reviewer in supabase/migrations). See spec
// §2.1, §2.3 step 8. Phase 2 work.

export async function approveReport(_reportId: string, _reviewerId: string): Promise<never> {
  throw new Error("approveReport: not yet implemented (Phase 2)");
}
