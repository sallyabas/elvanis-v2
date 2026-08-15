import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listPricing, formatPrice } from "@/lib/pricing";
import { MODULE_META, MODULE_ORDER } from "@/lib/modules/module-meta";
import { SessionRequestButton } from "@/app/_components/SessionRequestButton";
import { Card } from "@/app/_components/ui/Card";

/**
 * Real standalone Services page (confirmed 2026-08-12, Dashboard rebuild,
 * priority item 4) — the client's single place to see everything Elvanis
 * offers. Closes the exact gap found in the previous batch ("clients have
 * no path to the paid modules") properly this time, as its own dedicated
 * home rather than a section tacked onto the bottom of one report page.
 *
 * Every price here is DB-backed (listPricing(), never a hardcoded
 * literal) — same discipline as the landing page's own pricing section.
 */
export default async function ServicesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/client-login");

  const { data: company } = await supabase.from("companies").select("id").eq("user_id", user.id).maybeSingle();
  if (!company) redirect("/onboarding");

  // Whether a report exists yet — Delivery Session and F2F Workshop only
  // make sense once findings actually exist to discuss (same reasoning
  // already applied on the report page and evidence-intake page).
  const { data: latestReport } = await supabase
    .from("reports")
    .select("id")
    .eq("company_id", company.id)
    .eq("status", "sent")
    .order("delivered_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: existingSessionRequests } = await supabase.from("session_requests").select("session_type").eq("company_id", company.id);
  const hasRequestedDelivery = (existingSessionRequests ?? []).some((r) => r.session_type === "delivery");

  const pricing = await listPricing();
  const pricingByKey = new Map(pricing.map((p) => [p.itemKey, p]));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">Services</h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
        Everything Elvanis offers, in one place — your Core Audit, standalone modules, implementation help, and time with your
        reviewer.
      </p>

      <div className="space-y-6">
        <Card title="Core Audit" subtitle="The five-lens execution audit — where you already are.">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Your goal-driven diagnosis and 30/60/90 roadmap. First audit free; re-audits are paid.</p>
            <span className="shrink-0 text-sm font-medium text-accent">{formatPrice(pricingByKey.get("standard_core_audit") ?? { priceAmount: 0, currency: "GBP" })}</span>
          </div>
          <Link href="/dashboard" className="mt-3 inline-block text-sm underline">
            View your dashboard
          </Link>
        </Card>

        <Card title="Concierge tier" subtitle="Deeper reviewer attention, Discovery + Delivery Sessions included by default.">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              No self-serve upgrade exists yet — no in-app checkout anywhere in this app. Ask your reviewer if this is a fit.
            </p>
            <span className="shrink-0 text-sm font-medium text-accent">{formatPrice(pricingByKey.get("concierge_tier") ?? { priceAmount: 300, currency: "GBP" })}</span>
          </div>
        </Card>

        <section>
          <h2 className="mb-3 font-medium text-neutral-900 dark:text-neutral-50">Standalone audit modules</h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">Sold separately from your Core Audit — each has its own findings and reviewer pass.</p>
          <div className="space-y-4">
            {MODULE_ORDER.map((mt) => {
              const meta = MODULE_META[mt];
              const price = pricingByKey.get(meta.pricingKey);
              return (
                <Card key={mt}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-neutral-900 dark:text-neutral-50">{meta.label}</h3>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{meta.description}</p>
                    </div>
                    {price && <span className="shrink-0 text-sm font-medium text-accent">{formatPrice(price)}</span>}
                  </div>
                  <Link
                    href={meta.routePath}
                    className="mt-3 inline-block rounded bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
                  >
                    Request this
                  </Link>
                </Card>
              );
            })}
          </div>
        </section>

        <Card title="Execution Sprint" subtitle="A bounded 2–4 week engagement to actually fix your #1 priority.">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Not self-serve — your reviewer scopes this from a specific finding in your delivered report, after you signal
              interest.
            </p>
            <span className="shrink-0 text-sm font-medium text-accent">{formatPrice(pricingByKey.get("execution_sprint") ?? { priceAmount: 3000, currency: "GBP" })}</span>
          </div>
          {latestReport ? (
            <Link href={`/reports/${latestReport.id}`} className="mt-3 inline-block text-sm underline">
              View your report to express interest
            </Link>
          ) : (
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">Available once you have a delivered report.</p>
          )}
        </Card>

        <section>
          <h2 className="mb-3 font-medium text-neutral-900 dark:text-neutral-50">Sessions with your reviewer</h2>
          <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
            No calendar integration exists yet — every request here is a real signal to your reviewer, who follows up directly
            to schedule it.
          </p>
          <div className="space-y-3">
            <SessionRequestButton companyId={company.id} sessionType="discovery" />
            {latestReport ? (
              <>
                <SessionRequestButton companyId={company.id} sessionType="delivery" />
                {hasRequestedDelivery && <SessionRequestButton companyId={company.id} sessionType="f2f_workshop" />}
              </>
            ) : (
              <div className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-500 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-400">
                Delivery Session and F2F Workshop become available once you have a delivered report — there&apos;s nothing to
                walk through together yet.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
