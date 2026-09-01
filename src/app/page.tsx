import Link from "next/link";
import type { Metadata } from "next";
import { listPricing, formatPrice } from "@/lib/pricing";
import { getTotalTurnaroundHours } from "@/lib/reports/sla";
import { getSettingNumber } from "@/lib/app-settings";
import { MODULE_LEGAL_DISCLAIMER } from "@/lib/modules/legal-disclaimer";
import { InteractiveDemoSection } from "./_components/InteractiveDemoSection";
import { AI_READINESS_DEMO_STEPS } from "./_components/AiReadinessDemoSteps";

/**
 * Full landing page rebuild (confirmed 2026-09-01) — supersedes the
 * 2026-08-07 build (and every "v2"/"item"-numbered edit made to it since).
 * Reflects the two-core positioning decided this session, confirmed
 * explicitly before this rebuild started: "AI Readiness Review" (this
 * page's own new term for the existing AI Audit triage → module flow —
 * Tender Readiness / AI Reliability Audit / Data Protection Compliance)
 * is now PRIMARY; "Execution Audit" (this page's own new term for the
 * existing 5-lens Core Audit / Business Diagnosis) is SECONDARY. This is
 * landing-page-only terminology, confirmed explicitly — nothing in-app
 * (sidebar, routes, DB) changes names.
 *
 * Grounded in real, cited 2026 research (see the complexity/risk report
 * delivered before this build): lead with outcome not "AI-powered"
 * framing, Feature-Benefit Transformation for module copy, real product
 * content over generic illustration where honestly achievable, one H1
 * matching the meta title, meta title/description within stated character
 * budgets. Every number on this page is real and DB/settings-backed —
 * pricing via listPricing(), turnaround via getTotalTurnaroundHours()/
 * getSettingNumber() — never an invented marketing stat.
 *
 * Written as one continuous narrative, not stacked independent blocks
 * (direct founder instruction): the hero's trigger ("before they ask")
 * recurs through the problem section, the solution section, why-us, and
 * the FAQ's own security-questionnaire answer — the same voice and
 * stakes are meant to still be present at the bottom of the page as at
 * the top, not reset section by section.
 */
export const revalidate = 60;

// Page-level metadata (confirmed 2026-09-01) — overrides the root
// layout's metadata for this route only; every other route keeps the
// root's own fallback untouched (Next.js resolves the most specific
// metadata export per route). Title 43 chars, description 134 chars —
// both verified by direct character count before finalizing, not
// eyeballed. The description's "48 hours" is the real, documented
// default (module_delivery_turnaround_target_hours) — deliberately a
// static value for this search-snippet text (not worth an async DB read
// purely for a meta tag); the ON-PAGE body copy below reads the live
// setting instead, so a reviewer's real adjustment shows up where a
// visitor actually sees it.
export const metadata: Metadata = {
  title: "AI Readiness Review for B2B Teams | Elvanis",
  description:
    "Get an evidence-based AI Readiness Review before your next procurement or security review — human-reviewed, typically within 48 hours.",
};

/**
 * Real Calendly link (unchanged, preserved per explicit instruction) —
 * the founder's own account URL. This app has no calendar integration of
 * its own anywhere (a deliberate choice — see the Service Layer's
 * request-and-human-follow-up design).
 */
const CALENDLY_URL = "https://calendly.com/elvanis-app/30min";

export default async function LandingPage() {
  const pricing = await listPricing();
  const pricingByKey = new Map(pricing.map((p) => [p.itemKey, p]));
  const { totalHours: executionAuditTotalHours } = await getTotalTurnaroundHours();
  const moduleTurnaroundHours = await getSettingNumber("module_delivery_turnaround_target_hours", 48);

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <span className="text-lg font-semibold tracking-tight text-neutral-900">Elvanis</span>
          <nav className="flex flex-wrap items-center gap-5 text-sm text-neutral-600">
            <a href="#how-it-works" className="hover:text-neutral-900 hover:underline">
              How it works
            </a>
            <a href="#modules" className="hover:text-neutral-900 hover:underline">
              Modules
            </a>
            <a href="#pricing" className="hover:text-neutral-900 hover:underline">
              Pricing
            </a>
            <a href="#faq" className="hover:text-neutral-900 hover:underline">
              FAQ
            </a>
            <Link href="/client-login" className="font-medium text-accent-cta underline hover:text-accent-cta-hover">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-col px-6">
        {/* ================= 1. HERO ================= */}
        <section className="py-6 sm:py-8">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">For teams running AI in production</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-5xl">
            Your AI Readiness Review, before they ask.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600">
            Get a documented answer for your next procurement questionnaire, security review, or investor question about your
            AI — reviewed by a human, typically ready within {moduleTurnaroundHours} hours.
          </p>

          {/* Exactly one primary CTA + one secondary TEXT link, never two
              competing hero cards (direct instruction). "Book a demo" was
              removed from the hero specifically — it's not gone from the
              page, it keeps its own full section further down (10). */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/client-login"
              className="rounded bg-accent-cta px-5 py-3 text-sm font-medium text-white hover:bg-accent-cta-hover"
            >
              Start your AI Readiness Review
            </Link>
          </div>
          <p className="mt-4 text-sm text-neutral-500">
            No card required to start — every review&apos;s real price is shown before you request it.{" "}
            <a href="#execution-audit" className="font-medium text-accent-cta underline hover:text-accent-cta-hover">
              Not about AI specifically? See the Execution Audit ↓
            </a>
          </p>

          {/* Hero-gap fix, Option B (confirmed 2026-09-01 — fastest to ship
              correctly, per explicit instruction; Option A held for a real
              screenshot when one exists, see AiReadinessDemoSteps.tsx's own
              docblock for why a literal raster capture wasn't available
              this pass). Exact requested copy, no background colour, real
              claims — "48 hours" reads from the same live setting used
              everywhere else on this page, not a separately hardcoded
              number that could drift from it. */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">
            {["Evidence-based", "Human-reviewed", `Delivered within ${moduleTurnaroundHours} hours`].map((label) => (
              <div key={label} className="flex items-center gap-2 text-sm text-neutral-700">
                <span aria-hidden="true" className="text-accent-cta">
                  ✓
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ================= 2. THE PROBLEM ================= */}
        <section className="border-t border-neutral-200 py-6">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Someone is about to ask about your AI</h2>
          <p className="mt-3 max-w-2xl text-neutral-600">
            Not hypothetically — this is already how AI gets scrutinized in a real deal, a real security review, or a real
            board conversation.
          </p>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                title: "A procurement questionnaire",
                body: "Enterprise and public-sector buyers now ask AI-specific questions before they'll sign — \"we'll get back to you\" isn't a good look mid-deal.",
              },
              {
                title: "A security review",
                body: "Your customer's security team wants to know what your AI actually does with their data, and whether a human is watching what it produces.",
              },
              {
                title: "An investor question",
                body: "Diligence increasingly asks what AI you're running and whether you can prove it's governed — not just that a policy document exists somewhere.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="font-medium text-neutral-900">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-600">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl font-medium text-neutral-900">
            Elvanis gives you a documented, evidence-based answer to exactly this — before you&apos;re asked for one.
          </p>
        </section>

        {/* ================= 3. THE SOLUTION (new) ================= */}
        <section className="border-t border-neutral-200 py-6">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Evidence in. Human-reviewed findings out. No generic advice.
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-600">
            You submit real evidence — a document, or a short guided form. We tell you what&apos;s safe, what&apos;s
            genuinely missing, and what to fix first. A human checks every word before you see it.
          </p>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                title: "What's safe",
                body: "Genuine findings that show something is fine get reported as fine — never padded with invented risk to look more thorough than the evidence supports.",
              },
              {
                title: "What's genuinely missing",
                body: "If you don't have the documentation, trace logs, or a specific answer, that gap becomes a flagged finding automatically — guaranteed in code, never left to an AI's discretion to remember.",
              },
              {
                title: "What to fix first",
                body: "Every finding carries a real severity and a concrete recommended action, so you know what actually needs attention now versus what can wait.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="font-medium text-neutral-900">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-600">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl font-medium text-neutral-900">
            Every one of these is accepted, edited, or rejected by a human reviewer before it ever reaches you — enforced at
            the system level, not a policy we just say we follow.
          </p>
        </section>

        {/* ================= 4. WHY US ================= */}
        <section className="border-t border-neutral-200 py-6">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Built so you&apos;re ready before they ask.</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                title: "Always human-reviewed",
                body: "A human reviewer accepts, edits, or rejects every single AI-drafted finding before it's ever shown to you. This is enforced at the system level, not a policy we just say we follow.",
              },
              {
                title: "Missing evidence is itself a finding",
                body: "If you don't have documentation, trace logs, or a specific answer, that gap gets flagged automatically — guaranteed in code, never a silent gap in your report.",
              },
              {
                title: "Source-agnostic evidence",
                body: "Upload a document (we extract the text automatically) or fill in a short guided form — no forced integrations, no OAuth handoff to a tool you don't already trust.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="font-medium text-neutral-900">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-600">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ================= 5. MODULES (Feature-Benefit rewrite) ================= */}
        <section id="modules" className="border-t border-neutral-200 py-6">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Three reviews. One matched to what&apos;s actually at stake.
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-600">
            Whichever one applies to you, the process is the same: real evidence in, human-reviewed findings out — never a
            generic checklist.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              {
                key: "tender_readiness",
                title: "Tender Readiness",
                body: `Know exactly which AI regulations actually apply to you — EU AI Act, UAE DIFC Regulation 10, Saudi AI governance — with a documented jurisdiction determination and draft procurement answers ready within ${moduleTurnaroundHours} hours.`,
              },
              {
                key: "ai_reliability_audit",
                title: "AI Reliability Audit",
                body: `Find out how your AI actually behaves under pressure — tested against documented real-world failure patterns like invented policy and prompt injection — with a human-reviewed reliability report within ${moduleTurnaroundHours} hours, before a customer finds the gap themselves.`,
              },
              {
                key: "data_protection_compliance",
                title: "Data Protection Compliance",
                body: `See precisely where your GDPR/PDPL readiness stands — consent, data-subject rights, retention, breach response, cross-border transfer — with a human-reviewed report within ${moduleTurnaroundHours} hours.`,
              },
            ].map((mod) => {
              const price = pricingByKey.get(mod.key);
              return (
                <div key={mod.key} className="rounded-lg border border-neutral-200 p-6 shadow-card-1">
                  <h3 className="font-medium text-neutral-900">{mod.title}</h3>
                  <p className="mt-2 text-sm text-neutral-600">{mod.body}</p>
                  {price && <p className="mt-4 text-sm font-medium text-accent-cta">{formatPrice(price)}</p>}
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            Not sure which applies to you?{" "}
            <Link href="/client-login" className="font-medium text-accent-cta underline hover:text-accent-cta-hover">
              Answer 3 quick questions
            </Link>{" "}
            and we&apos;ll match you — see exactly how in the demo below.
          </p>
        </section>

        {/* ================= 6. HOW IT WORKS (AI Audit path primary) =================
            Reduced from 5 steps to 3 (confirmed 2026-09-02, direct founder
            fix — measured live first: at a real 1280px desktop viewport,
            5 columns in this max-w-5xl section were only ~170px wide
            each, genuinely too narrow for body text to read comfortably,
            not just a font-size problem). Kept the 3 steps that carry the
            real differentiators (intake, deterministic matching, mandatory
            human review); dropped "submit evidence" and "get findings" as
            their own steps here — not lost content, the Interactive Demo
            immediately below already walks through exactly those two
            steps in real depth, so the "fuller explanation" link points
            there rather than duplicating it. */}
        <section id="how-it-works" className="border-t border-neutral-200 py-6">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">How your AI Readiness Review actually works</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "1",
                title: "Answer 3 quick questions",
                body: "Are you using AI with customers, had a compliance or procurement request, or handling personal data? That's the whole intake — a routing decision, not a form.",
              },
              {
                step: "2",
                title: "Get matched, with real reasoning",
                body: "The match is computed from your answers, never guessed — Tender Readiness, AI Reliability Audit, Data Protection Compliance, or a straight conversation with a human.",
              },
              {
                step: "3",
                title: "A human reviews every finding",
                body: "Every AI-drafted finding — including any guaranteed one for genuinely missing evidence — is accepted, edited, or rejected by a person before it's ever shown to you.",
              },
            ].map((s) => (
              <li key={s.step}>
                <span className="text-sm font-semibold text-accent">{s.step}</span>
                <h3 className="mt-1 font-medium text-neutral-900">{s.title}</h3>
                <p className="mt-1 text-sm text-neutral-600">{s.body}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-neutral-500">
            That&apos;s the overview —{" "}
            <a href="#see-it-work" className="font-medium text-accent-cta underline hover:text-accent-cta-hover">
              see the full walkthrough below
            </a>
            , including real evidence submission and real findings.
          </p>
        </section>

      </div>

      {/* ================= 7. INTERACTIVE DEMO =================
          Deliberately breaks out of the shared max-w-5xl column
          (confirmed 2026-09-01, direct instruction: "the widest, most
          visually prominent section on the page after the hero") — its
          own wider container, a sibling of the max-w-5xl wrapper rather
          than nested inside it, so every other section stays at its
          existing width. The two max-w-5xl wrapper divs around it split
          what was previously one — the second one keeps flex-1 so the
          footer's mt-auto still reaches the true bottom of the page,
          unchanged.
          Widened further and given a full-bleed light background
          (confirmed 2026-09-02, direct founder fix — "near-full width...
          a very light background... to visually distinguish it as a
          separate interactive zone"): max-w-6xl -> max-w-7xl (1280px,
          the widest section on the page by a clear margin now), and
          bg-neutral-100 (#f5f5f4, matching the exact hex requested)
          applied to the SECTION itself so the wash spans edge-to-edge,
          not just the constrained content column — the demo widget's
          own bg-neutral-50 (#fafafa, very slightly lighter) still sits
          inside it, so the widget now reads as a real card floating on
          a distinct zone, not one flat identical gray. */}
      <section id="see-it-work" className="border-t border-neutral-200 bg-neutral-100 py-6">
        <div className="mx-auto w-full max-w-7xl px-6">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">See it work — no sign-in, no leaving this page</h2>
          <p className="mt-3 max-w-2xl text-neutral-600">
            Click any step, use the arrows, or just let it play. Step 4 shows real, verbatim findings from an actual delivered
            review.
          </p>
          <div className="mt-8">
            <InteractiveDemoSection steps={AI_READINESS_DEMO_STEPS} />
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
        {/* ================= 8. EXECUTION AUDIT (secondary, condensed) =================
            This is what the hero's own secondary text link jumps to. Deliberately
            NOT a full top-level section matching sections 2-7's depth — the
            five-lens breakdown that used to be its own dedicated section on the
            old, single-core page is condensed into this one block, since
            Execution Audit is now the secondary product, not the page's own
            narrative spine. Conflict Detection lives here, not in "Why us"
            above — it's a real, genuine differentiator of THIS product
            specifically (Conflict Detection runs across a Core Audit's five
            lenses; the three AI Readiness Review modules each have their own,
            different duplicate-finding safeguards instead), so claiming it as a
            universal "Why us" point under AI Readiness Review's own primary
            framing would have overstated what's actually true there. */}
        <section id="execution-audit" className="border-t border-neutral-200 py-6">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Not about AI specifically? Try the Execution Audit.
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-600">
            If your actual bottleneck is margin, growth, retention, execution speed, or product delivery, the Execution Audit
            runs five independent AI lenses — Financial, Commercial, Execution, Product, and AI &amp; Governance — against
            your stated goal, and checks every finding against every other one before a reviewer ever sees it. It catches
            when your own data tells two different stories, instead of two contradictory findings both quietly reaching you.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {/* Card treatment/weight matched to the Modules cards above
                (confirmed 2026-09-01, direct instruction — "a real offer,
                not a footnote"): the same shadow-card-1 elevation, and a
                prominent, top-of-card price statement mirroring how
                Modules/Pricing anchor real offers with a bold price, not
                a small footnote line. */}
            <div className="rounded-lg border border-neutral-200 p-6 shadow-card-1">
              <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">Execution Audit</p>
              <p className="mt-1 text-3xl font-semibold text-neutral-900">Free</p>
              <p className="mt-3 text-sm text-neutral-600">
                A ranked, financially-quantified top 3, with a 30/60/90 day roadmap — reviewed by a human, ready within{" "}
                {executionAuditTotalHours} hours. Your first completed audit is free; re-audits are paid.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/client-login"
                  className="rounded bg-accent-cta px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-cta-hover"
                >
                  Start your Execution Audit
                </Link>
                <Link
                  href="/demo-live"
                  className="rounded border border-accent-cta px-5 py-2.5 text-sm font-medium text-accent-cta hover:bg-accent-cta hover:text-white"
                >
                  View a real, complete example
                </Link>
              </div>
            </div>

            {/* Real, verbatim content from /demo-live (Riverbank Analytics
                Ltd, a test company built specifically to be safe for public
                display) — not fabricated example data. */}
            {/* All text bumped to a minimum of text-sm/14px (confirmed
                2026-09-02, direct founder fix) — the caption and the
                roadmap day labels were previously 10px/11px, both under
                the requested 13px floor. */}
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 shadow-card-1">
              <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">Real example — Riverbank Analytics Ltd</p>
              <p className="mt-2 text-sm font-medium text-neutral-900">Top 3 priorities</p>
              <ol className="mt-1 list-inside list-decimal text-sm text-neutral-700">
                <li>Gross Margin Trend</li>
                <li>Increasing Hosting and Support Costs</li>
                <li>Cash Flow Runway</li>
              </ol>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-sm text-neutral-600">
                {["30 days", "60 days", "90 days"].map((d) => (
                  <div key={d} className="rounded border border-neutral-200 bg-white p-2">
                    {d}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ================= 9. PRICING (mirrors the in-app Services page) ================= */}
        <section id="pricing" className="border-t border-neutral-200 py-6">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Pricing</h2>
          <p className="mt-3 max-w-2xl text-neutral-600">
            Real, live pricing — the same numbers shown inside the product, not a sales-call-to-find-out.
          </p>

          <div className="mt-10 space-y-10">
            <div>
              <h3 className="mb-4 text-base font-semibold text-neutral-900">Execution Audit</h3>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex flex-col rounded-lg border-2 border-neutral-300 p-6">
                  <p className="text-sm font-medium uppercase tracking-wide text-neutral-500">Standard</p>
                  <p className="mt-2 text-3xl font-semibold text-neutral-900">Free</p>
                  <p className="mt-2 text-sm text-neutral-600">
                    Your first completed audit — all five lenses, full human review, top 3 priorities and a 30/60/90 roadmap.
                    Re-audits are always paid.
                  </p>
                  <Link
                    href="/client-login"
                    className="mt-6 inline-block self-start rounded bg-accent-cta px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-cta-hover"
                  >
                    Get started
                  </Link>
                </div>
                <div className="flex flex-col rounded-lg border-2 border-accent p-6">
                  <p className="text-sm font-medium uppercase tracking-wide text-accent-cta">Concierge</p>
                  {/* Real price, visible (confirmed 2026-09-02, direct
                      founder fix) — "Contact Sales" here directly
                      contradicted this section's own "real, live pricing,
                      not a sales-call-to-find-out" subhead. £300 is the
                      real, non-placeholder concierge_tier price, same
                      source as every other figure on this page. The
                      button now routes to /client-login (the same
                      "sign in first" pattern as every other real,
                      requestable action on this page) rather than
                      Calendly — the real in-app mechanism for requesting
                      Concierge is a session-scoped action, so the honest
                      landing-page CTA is the sign-in path, not a call. */}
                  <p className="mt-2 text-3xl font-semibold text-neutral-900">
                    {formatPrice(pricingByKey.get("concierge_tier") ?? { priceAmount: 300, currency: "GBP" })}
                  </p>
                  <p className="mt-2 text-sm text-neutral-600">
                    Everything in Standard, plus a Discovery Session and a Delivery Session included by default, and deeper
                    reviewer attention on ambiguous findings.
                  </p>
                  {/* ?plan=concierge (confirmed 2026-09-02, direct
                      founder fix) — a real tracking parameter, not a
                      functional route: /client-login itself never reads
                      searchParams (confirmed by reading the page
                      directly), so this passes through harmlessly and is
                      available for later analytics/attribution work. */}
                  <Link
                    href="/client-login?plan=concierge"
                    className="mt-6 inline-block self-start rounded bg-accent-cta px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-cta-hover"
                  >
                    Request Concierge
                  </Link>
                </div>
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-base font-semibold text-neutral-900">AI Readiness Review modules</h3>
              <div className="grid gap-6 sm:grid-cols-3">
                {[
                  { key: "tender_readiness", title: "Tender Readiness" },
                  { key: "ai_reliability_audit", title: "AI Reliability Audit" },
                  { key: "data_protection_compliance", title: "Data Protection Compliance" },
                ].map((mod) => {
                  const price = pricingByKey.get(mod.key);
                  return (
                    <div key={mod.key} className="rounded-lg border border-neutral-200 p-6">
                      <p className="font-medium text-neutral-900">{mod.title}</p>
                      {price && <p className="mt-2 text-2xl font-semibold text-neutral-900">{formatPrice(price)}</p>}
                      <p className="mt-2 text-xs text-neutral-500">Human-reviewed, typically within {moduleTurnaroundHours} hours.</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-4 text-base font-semibold text-neutral-900">Execution Sprint</h3>
              <div className="rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-neutral-900">A bounded 2–4 week engagement to actually fix your #1 priority.</p>
                  <span className="shrink-0 text-lg font-semibold text-neutral-900">
                    {formatPrice(pricingByKey.get("execution_sprint") ?? { priceAmount: 3000, currency: "GBP" })}
                  </span>
                </div>
                <p className="mt-2 text-sm text-neutral-500">
                  🔒 Unlocked after your first report — every sprint is scoped to a specific finding, so there&apos;s nothing to
                  point it at until then.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================= 10. FAQ ================= */}
        <section id="faq" className="border-t border-neutral-200 py-6">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">Frequently asked questions</h2>
          <div className="mt-8 max-w-2xl divide-y divide-neutral-200">
            {[
              {
                q: "Is this legal certification?",
                a: `No. ${MODULE_LEGAL_DISCLAIMER}`,
              },
              {
                q: "What counts as “AI in production”?",
                a: "Live AI features actually running for real users, not internal experiments — that's the exact, real distinction we use throughout your review, including to flag governance urgency where it applies.",
              },
              {
                q: "How is this different from a security questionnaire?",
                a: "A security questionnaire is self-reported and rarely checked. Elvanis reviews your actual submitted evidence, cross-checks it, and has a human reviewer sign off before you see anything — plus produces real, jurisdiction-specific findings and draft answers you can hand to whoever's asking, not just a completed checkbox form.",
              },
              {
                q: "Is my data safe?",
                a: "Your evidence is sent to Groq, our named AI provider, to draft findings — it's never used to train any model, and we never share it with any other third party. Everything is stored in Supabase, access-restricted to your account and the human reviewers on your review. You can request deletion of your account and data at any time. Full detail in our Privacy Policy.",
              },
              {
                q: "How long does it actually take?",
                a: `AI Readiness Review modules: no edit window, typically reviewed within ${moduleTurnaroundHours} hours of submission. Execution Audit: ${executionAuditTotalHours} hours total, as one number — a 24-hour window where you can keep editing or adding evidence, then human review once that window closes.`,
              },
              {
                q: "Do I need to connect any tools?",
                a: "No — there's no OAuth, no live integration required. Upload a document (we extract the text automatically) or fill in a short guided form. Leaving a field blank is treated as meaningful evidence too, not an incomplete submission.",
              },
              {
                q: "What if I don't have clean data for every question?",
                a: "That's expected, and it's still useful — missing evidence is itself flagged as a finding rather than silently skipped, so a reviewer sees exactly where your visibility gaps are, not just where your answers are good.",
              },
              {
                q: "Is this a one-off report, or ongoing?",
                a: "Each review is a point-in-time assessment. New evidence after a delivered report starts a new, separate review — your original stays frozen in your history so you can track what changed.",
              },
            ].map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-neutral-900">
                  {item.q}
                  <span className="ml-4 text-accent-cta group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm text-neutral-600">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ================= 11. CONTACT US / BOOK A DEMO (preserved, per explicit instruction) ================= */}
        <section className="border-t border-neutral-200 py-6">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Not ready to submit evidence yet? Talk it through first.
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6">
              <h3 className="font-medium text-neutral-900">Book a demo now</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Pick a time yourself, right now — no signup, no evidence needed. Fastest way to talk to someone.
              </p>
              <Link
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded bg-accent-cta px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-cta-hover"
              >
                Book a demo →
              </Link>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6">
              <h3 className="font-medium text-neutral-900">Request a Discovery Session</h3>
              <p className="mt-2 text-sm text-neutral-600">
                Offered on every plan, no extra cost on Standard, included by default on Concierge. Sign up and request one
                directly from your evidence intake page, any time before or during submission — we&apos;ll follow up to
                schedule it.
              </p>
              <Link
                href="/client-login"
                className="mt-4 inline-block rounded border border-accent-cta px-5 py-2.5 text-sm font-medium text-accent-cta hover:bg-accent-cta hover:text-white"
              >
                Sign up and request one
              </Link>
            </div>
          </div>
        </section>

        {/* ================= 12. FINAL CTA + FOOTER ================= */}
        <section className="border-t border-neutral-200 py-6">
          <div className="rounded-lg border-l-4 border-accent bg-[#fffbf0] p-8 text-center shadow-card-2">
            <h2 className="text-xl font-semibold text-neutral-900">Would your AI pass a real review?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
              See exactly which one applies to you — before your next procurement, security, or investor question does.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <Link href="/client-login" className="rounded bg-accent-cta px-5 py-3 text-sm font-medium text-white hover:bg-accent-cta-hover">
                Start your AI Readiness Review
              </Link>
              <a href="#execution-audit" className="text-sm font-medium text-accent-cta underline hover:text-accent-cta-hover">
                Or see the Execution Audit
              </a>
            </div>
          </div>
        </section>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200 py-6 text-xs text-neutral-500">
          <span>© {new Date().getFullYear()} Elvanis</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            <Link href="/client-login" className="hover:underline">
              Get started
            </Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
