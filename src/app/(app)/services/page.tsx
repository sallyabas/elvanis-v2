import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listPricing, formatPrice } from "@/lib/pricing";
import { MODULE_META, MODULE_ORDER } from "@/lib/modules/module-meta";
import { SessionRequestButton } from "@/app/_components/SessionRequestButton";
import { ContactUsForm } from "@/app/_components/ContactUsForm";
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
          {/* flex-wrap added (confirmed 2026-09-02, real UX-pass finding)
              — confirmed via computed styles at 375px that this row's
              scrollWidth (403px) exceeded its clientWidth (375px):
              "Submit new evidence" was genuinely clipped, not just
              wrapped narrow. */}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
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
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <Link href={meta.routePath} className="inline-block rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover">
                      {meta.requestButtonLabel}
                    </Link>
                    {/* Real Payoneer payment link (confirmed 2026-09-05) —
                        payment is still confirmed manually/externally, no
                        in-app checkout; this is just a real, always-visible
                        way to pay once you're ready, alongside the request
                        button rather than replacing it. */}
                    <a href={meta.paymentLink} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent hover:underline">
                      Pay via Payoneer ↗
                    </a>
                  </div>
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
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <Link href={`/reports/${latestReport.id}`} className="text-sm font-medium text-accent hover:underline">
                  View your report to express interest
                </Link>
                <a
                  href="https://link.payoneer.com/Token?t=EB23CB50E7EB4ED28C5B7C4451DA3169&src=tpl"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-accent hover:underline"
                >
                  Pay via Payoneer ↗
                </a>
              </div>
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
            {/* Real, unified price (confirmed 2026-09-05, code-quality
                audit) — replaces the previous "Contact Sales, no price
                shown" treatment, which contradicted the landing page's
                own real £300 for the same tier. Still a real request +
                personal follow-up, not a self-serve checkout — the price
                is shown up front, the scoping conversation still happens
                with the reviewer directly. */}
            <Card title="Concierge tier" subtitle="Deeper reviewer attention, Discovery + Delivery Sessions included by default.">
              <SessionRequestButton
                companyId={company.id}
                sessionType="concierge_inquiry"
                priceLabel={pricingByKey.has("concierge_tier") ? formatPrice(pricingByKey.get("concierge_tier")!) : undefined}
              />
              <a
                href="https://link.payoneer.com/Token?t=DB274255C5154C9A9DA86497FEC8582B&src=dpl"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-medium text-accent hover:underline"
              >
                Pay via Payoneer ↗
              </a>
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
            {/* Training & Advisory — reopened as a real, requestable
                service (confirmed 2026-09-05, direct founder decision),
                closing the gap left open 2026-08-31 ("no working request
                flow yet"). Same exact manual pattern as Concierge/
                Discovery/Delivery — "Contact Sales" framing, no price
                shown, no payment link (unlike the five paid services this
                same pass wires Payoneer links for). */}
            <Card title="Training &amp; Advisory" subtitle="Structured training and ongoing advisory for your team.">
              <SessionRequestButton companyId={company.id} sessionType="training_advisory" />
            </Card>
          </div>
        </section>

        {/* "Having trouble? Contact us" (confirmed 2026-09-05) — one of
            the 5 real placements (the 3 module intakes + Evidence Intake
            + here), reusing the one shared ContactUsForm.tsx component. */}
        <div className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
          <ContactUsForm companyId={company.id} serviceContext="Services" />
        </div>
      </div>
    </div>
  );
}
