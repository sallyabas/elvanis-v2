import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { LensFinding } from "@/lib/lenses/types";
import { deriveRoadmap } from "@/lib/reports/roadmap";

// Dashboard — current, live state (confirmed 2026-08-04, Priority 3):
// latest top-3 priorities + roadmap status, drawn from the most recently
// sent report. Active Execution Sprint progress is correctly absent — no
// Execution Sprint feature exists anywhere in this codebase yet (V2/V3
// scope, zero app code), matching CLAUDE.md's own documented status.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/client-login");
  }

  const { data: company } = await supabase.from("companies").select("id, name").eq("user_id", user.id).maybeSingle();
  if (!company) {
    redirect("/onboarding");
  }

  const { data: latestReport } = await supabase
    .from("reports")
    .select("id, top_3_finding_ids")
    .eq("company_id", company.id)
    .eq("status", "sent")
    .order("delivered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let top3: LensFinding[] = [];
  if (latestReport) {
    const top3Ids = (latestReport.top_3_finding_ids as string[]) ?? [];
    if (top3Ids.length > 0) {
      const { data: findings } = await supabase
        .from("lens_findings")
        .select("id, lens, ai_draft, reviewer_edited_content, reviewer_status")
        .in("id", top3Ids);
      top3 = (findings ?? [])
        .filter((f) => f.reviewer_status === "approved" || f.reviewer_status === "edited")
        .map((f) => (f.reviewer_edited_content ?? f.ai_draft) as LensFinding);
    }
  }
  const roadmap = deriveRoadmap(top3);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Dashboard</h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">{company.name}&apos;s current state.</p>

      {!latestReport && (
        <p className="rounded-lg border border-neutral-200 bg-white p-5 text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
          No delivered report yet.{" "}
          <Link href="/evidence-intake" className="underline">
            Submit your evidence
          </Link>{" "}
          to get started.
        </p>
      )}

      {latestReport && (
        <>
          <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-3 font-medium">Latest top-3 priorities</h2>
            {top3.length === 0 ? (
              <p className="text-sm text-neutral-500">No priorities to show.</p>
            ) : (
              <ol className="list-inside list-decimal space-y-2 text-sm">
                {top3.map((f) => (
                  <li key={f.findingId}>{f.title}</li>
                ))}
              </ol>
            )}
            <Link href={`/reports/${latestReport.id}`} className="mt-3 inline-block text-sm underline">
              View full report
            </Link>
          </section>

          <section className="mb-8">
            <h2 className="mb-3 font-medium">Roadmap status</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {(["day30", "day60", "day90"] as const).map((bucket, i) => (
                <div key={bucket} className="rounded border border-neutral-200 p-3 text-sm dark:border-neutral-800">
                  <h3 className="mb-2 font-medium">{[30, 60, 90][i]} days</h3>
                  {roadmap[bucket].length === 0 ? (
                    <p className="text-neutral-400">Nothing at this horizon</p>
                  ) : (
                    <ul className="space-y-1">
                      {roadmap[bucket].map((f) => (
                        <li key={f.findingId}>{f.title}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
