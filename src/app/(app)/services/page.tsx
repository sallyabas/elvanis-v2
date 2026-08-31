import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listPricing, formatPrice } from "@/lib/pricing";
import { MODULE_META, MODULE_ORDER } from "@/lib/modules/module-meta";
import { SessionRequestButton } from "@/app/_components/SessionRequestButton";
import { Card } from "@/app/_components/ui/Card";
import { LockedExecutionSprintCard } from "./LockedExecutionSprintCard";

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
  //
  // Real fix (confirmed 2026-08-26, navigation audit): this comment was
  // previously the ONLY mention of evidence-intake on this whole page —
  // read on its own, it could be misread as claiming a link to it existed
  // here. It never did (grepped for the literal href). The Core Audit
  // card below now carries a real "Submit new evidence" link.
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
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Services</h1>
      <p className="mb-8 text-sm text-neutral-500">
        Everything Elvanis offers, in one place — a pure catalog. Anything you&apos;ve already requested or received
        shows on your{" "}
        <Link href="/dashboard" className="text-accent hover:underline">
          Dashboard
        </Link>{" "}
        and{" "}
        <Link href="/reports" className="text-accent hover:underline">
          Reports &amp; History
        </Link>
        , not here.
      </p>

      <div className="space-y-8">
        <Card title="Core Audit" subtitle="The five-lens execution audit — where you already are.">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-600">Your goal-driven diagnosis and 30/60/90 roadmap. First audit free; re-audits are paid.</p>
            <span className="shrink-0 text-sm font-medium text-accent">{formatPrice(pricingByKey.get("standard_core_audit") ?? { priceAmount: 0, currency: "GBP" })}</span>
          </div>
          <div className="mt-3 flex gap-4 text-sm">
            <Link href="/dashboard" className="font-medium text-accent hover:underline">
              View your dashboard
            </Link>
            <Link href="/evidence-intake" className="font-medium text-accent hover:underline">
              Submit new evidence
            </Link>
          </div>
        </Card>

        {/* Grouping 1 (confirmed 2026-08-31, sidebar rework item 8) — the
            three core modules, equal weight, directly requestable — no
            change to how each one works, just the section framing. */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-neutral-900">AI &amp; Compliance Modules</h2>
          <p className="mb-4 text-sm text-neutral-500">Sold separately from your Core Audit — each has its own findings and reviewer pass.</p>
          <div className="space-y-4">
            {MODULE_ORDER.map((mt) => {
              const meta = MODULE_META[mt];
              const price = pricingByKey.get(meta.pricingKey);
              return (
                <Card key={mt}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-medium text-neutral-900">{meta.label}</h3>
                      <p className="mt-1 text-sm text-neutral-600">{meta.description}</p>
                    </div>
                    {price && <span className="shrink-0 text-sm font-medium text-accent">{formatPrice(price)}</span>}
                  </div>
                  <Link href={meta.routePath} className="mt-3 inline-block rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover">
                    {meta.requestButtonLabel}
                  </Link>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Grouping 2 — Execution Sprint, kept separate from the modules
            above (confirmed 2026-08-31, item 8) and given a real locked
            state (item 5) until a delivered report exists — a sprint is
            always scoped to a specific finding, so there's genuinely
            nothing to point it at before then. No generic "Request
            Execution Sprint" button was added or considered — the
            existing per-finding interest mechanism (on the report page)
            stays the only way to start one, confirmed correct as-is. */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-neutral-900">Execution Sprint</h2>
          {latestReport ? (
            <Card subtitle="A bounded 2–4 week engagement to actually fix your #1 priority.">
              <div className="flex items-center justify-between">
                <p className="text-sm text-neutral-600">
                  Every Execution Sprint is scoped specifically to your #1 finding by your reviewer — fixed price, clear
                  outcome, no open-ended engagement. Signal interest from your report and your reviewer will follow up.
                </p>
                <span className="shrink-0 text-sm font-medium text-accent">{formatPrice(pricingByKey.get("execution_sprint") ?? { priceAmount: 3000, currency: "GBP" })}</span>
              </div>
              <Link href={`/reports/${latestReport.id}`} className="mt-3 inline-block text-sm font-medium text-accent hover:underline">
                View your report to express interest
              </Link>
            </Card>
          ) : (
            <LockedExecutionSprintCard />
          )}
        </section>

        {/* Grouping 3 — premium/human-led services (confirmed 2026-08-31,
            item 8): Concierge, Discovery Session, Delivery Session,
            Training & Advisory. F2F Workshop isn't a separate top-level
            item in this grouping — it's an upgrade *of* Delivery Session
            specifically (only ever offered once one's been requested), so
            it stays nested under Delivery here rather than removed. */}
        <section>
          <h2 className="mb-3 text-base font-semibold text-neutral-900">Work with your reviewer</h2>
          <p className="mb-4 text-sm text-neutral-500">
            No calendar integration exists yet — every request here is a real signal to your reviewer, who follows up
            directly to schedule it.
          </p>
          <div className="space-y-4">
            {/* "Contact Sales," not a price/buy flow (confirmed 2026-08-24)
                — Concierge is scoped and priced personally with the
                reviewer, not a self-serve checkout. */}
            <Card title="Concierge tier" subtitle="Deeper reviewer attention, Discovery + Delivery Sessions included by default.">
              <SessionRequestButton companyId={company.id} sessionType="concierge_inquiry" />
            </Card>
            <Card>
              <SessionRequestButton companyId={company.id} sessionType="discovery" />
            </Card>
            {latestReport ? (
              <Card>
                <SessionRequestButton companyId={company.id} sessionType="delivery" />
                {hasRequestedDelivery && <div className="mt-3">
                  <SessionRequestButton companyId={company.id} sessionType="f2f_workshop" />
                </div>}
              </Card>
            ) : (
              <div className="rounded border border-dashed border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-500">
                Delivery Session becomes available once you have a delivered report — there&apos;s nothing to walk
                through together yet.
              </div>
            )}
            {/* Training & Advisory (confirmed 2026-08-31, item 9) — a real,
                named future service, deliberately not given a working
                request flow yet (no session_type value exists for it, no
                reviewer queue handling) — a "Coming soon" placeholder is
                the honest state, not a button that goes nowhere. */}
            <Card title="Training &amp; Advisory" subtitle="Coming soon.">
              <p className="text-sm text-neutral-500">
                Structured training and ongoing advisory for your team — not yet a real, working request flow. Nothing
                to click here yet.
              </p>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
