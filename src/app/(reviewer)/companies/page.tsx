import { createAdminClient } from "@/lib/supabase/admin";
import { Card } from "@/app/_components/ui/Card";
import { CompaniesFilterClient, type CompanyDirectoryRow } from "./CompaniesFilterClient";

/**
 * Company directory (confirmed 2026-08-26, navigation audit) — reverses
 * the earlier "hold, queue-only for now" decision (see CLAUDE.md's own
 * 2026-08-16 writeup: "flagging this explicitly for the founder's own call
 * on whether it's worth building properly before pilots, or acceptable to
 * leave as queue-only for now"). Before this page, `/company/[companyId]`
 * was only ever reachable by clicking through from a request that already
 * named that company — there was no way to browse companies directly.
 *
 * Search/filter added (confirmed 2026-09-05, code-quality audit item 6) —
 * this page's own docblock originally deferred this explicitly ("no
 * filtering/search yet — that can be added once real client volume makes
 * it worth it"); closed now that real testing this session had already
 * surfaced concrete filter needs (plan tier, activity recency, entry
 * path) — see CompaniesFilterClient.tsx's own docblock for the reasoning
 * behind choosing exactly those three.
 *
 * "Last activity" is computed, not a single stored column — the most
 * recent of a few real signals (profile edits, evidence submission
 * activity, a report being submitted, a module request being created).
 * Deliberately doesn't reach into every possible activity table (sessions,
 * sprints) — this is a simple directory, not an analytics view; the
 * signals chosen are the most common/likely-recent ones. Computed in JS
 * across a handful of small queries rather than one complex SQL join,
 * matching this codebase's own established pattern for small-scale
 * internal-tooling aggregation (real client volume is still tiny).
 */
export default async function CompanyDirectoryPage() {
  const admin = createAdminClient();

  const { data: companies } = await admin
    .from("companies")
    .select("id, name, updated_at, user_id, entry_path, users(plan_tier)")
    .order("name", { ascending: true });

  const companyIds = (companies ?? []).map((c) => c.id as string);

  const [{ data: reports }, { data: moduleRequests }, { data: pendingSubmissions }] = await Promise.all([
    companyIds.length > 0
      ? admin.from("reports").select("company_id, submitted_at").in("company_id", companyIds)
      : Promise.resolve({ data: [] as { company_id: string; submitted_at: string | null }[] }),
    companyIds.length > 0
      ? admin.from("module_requests").select("company_id, created_at").in("company_id", companyIds)
      : Promise.resolve({ data: [] as { company_id: string; created_at: string | null }[] }),
    companyIds.length > 0
      ? admin.from("pending_evidence_submissions").select("company_id, updated_at").in("company_id", companyIds)
      : Promise.resolve({ data: [] as { company_id: string; updated_at: string | null }[] }),
  ]);

  const latestByCompany = new Map<string, string>();
  function considerActivity(companyId: string, date: string | null) {
    if (!date) return;
    const existing = latestByCompany.get(companyId);
    if (!existing || new Date(date).getTime() > new Date(existing).getTime()) {
      latestByCompany.set(companyId, date);
    }
  }
  for (const c of companies ?? []) considerActivity(c.id as string, c.updated_at as string | null);
  for (const r of reports ?? []) considerActivity(r.company_id as string, r.submitted_at as string | null);
  for (const m of moduleRequests ?? []) considerActivity(m.company_id as string, m.created_at as string | null);
  for (const p of pendingSubmissions ?? []) considerActivity(p.company_id as string, p.updated_at as string | null);

  const rows: CompanyDirectoryRow[] = (companies ?? [])
    .map((c) => {
      const usersRel = c.users as { plan_tier: string } | { plan_tier: string }[] | null;
      const planTier = Array.isArray(usersRel) ? (usersRel[0]?.plan_tier ?? "free") : (usersRel?.plan_tier ?? "free");
      return {
        id: c.id as string,
        name: c.name as string,
        planTier,
        entryPath: c.entry_path as string | null,
        lastActivity: latestByCompany.get(c.id as string) ?? null,
      };
    })
    .sort((a, b) => new Date(b.lastActivity ?? 0).getTime() - new Date(a.lastActivity ?? 0).getTime());

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900 dark:text-neutral-50">Companies</h1>
      <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
        Every client company — click through for their full context (profile, evidence, requests, payment status).
      </p>

      <Card>
        {rows.length === 0 ? <p className="text-sm text-neutral-500 dark:text-neutral-400">No companies yet.</p> : <CompaniesFilterClient rows={rows} />}
      </Card>
    </div>
  );
}
