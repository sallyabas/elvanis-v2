import Link from "next/link";
import type { Metadata } from "next";
import { listPricing, formatPrice } from "@/lib/pricing";
import { getTotalTurnaroundHours } from "@/lib/reports/sla";
import { getSettingNumber } from "@/lib/app-settings";
import { MODULE_LEGAL_DISCLAIMER } from "@/lib/modules/legal-disclaimer";
import { InteractiveDemoSection } from "./_components/InteractiveDemoSection";
import { AI_READINESS_DEMO_STEPS } from "./_components/AiReadinessDemoSteps";
import { TriageScreenMockup, FindingCardMockup } from "./_components/LandingPageMockups";

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
 *
 * Full visual-execution pass (confirmed 2026-09-02) — copy/structure/
 * routing all unchanged from the state above; every section restructured
 * from "one shared max-w-5xl wrapper div per group" into independent,
 * full-bleed <section> siblings (each with its own inner max-w-5xl — or
 * max-w-7xl for the demo — content column), because alternating,
 * edge-to-edge section backgrounds genuinely require each section to own
 * its own full-width background, the same technique already established
 * for the demo section's own light-then-dark zone. This actually
 * simplifies the DOM versus the previous two-wrapper-div-with-a-
 * breakout-in-the-middle structure: every section is now a uniform
 * direct child of the same root flex-col, so the footer's mt-auto still
 * reaches the true page bottom with no special-casing needed.
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

/**
 * Section headline treatment (confirmed 2026-09-02, direct founder fix,
 * item 4) — text-3xl (30px, inside the requested 28-32px band) + font-
 * bold (700) + text-neutral-900 (#1a1a1a exact). Applied as one shared
 * class string so every major section headline stays byte-identical,
 * never independently drifting. The founder's own list of 8 headlines
 * omitted 3 structurally identical section h2s ("Someone is about to
 * ask...", "Frequently asked questions", "Not ready to submit evidence
 * yet...") — applied here too, disclosed explicitly, since leaving just
 * those three at the old 24px/600 size while every sibling section
 * jumped to 30px/700 would read as an unintentional inconsistency, the
 * exact opposite of this pass's own stated goal.
 */
const SECTION_HEADLINE = "text-3xl font-bold text-neutral-900";

export default async function LandingPage() {
  const pricing = await listPricing();
  const pricingByKey = new Map(pricing.map((p) => [p.itemKey, p]));
  const { totalHours: executionAuditTotalHours } = await getTotalTurnaroundHours();
  const moduleTurnaroundHours = await getSettingNumber("module_delivery_turnaround_target_hours", 48);

  const MODULES = [
    {
      key: "tender_readiness",
      title: "Tender Readiness",
      slug: "tender-readiness",
      body: `Know exactly which AI regulations actually apply to you — EU AI Act, UAE DIFC Regulation 10, Saudi AI governance — with a documented jurisdiction determination and draft procurement answers ready within ${moduleTurnaroundHours} hours.`,
    },
    {
      key: "ai_reliability_audit",
      title: "AI Reliability Audit",
      slug: "ai-reliability",
      body: `Find out how your AI actually behaves under pressure — tested against documented real-world failure patterns like invented policy and prompt injection — with a human-reviewed reliability report within ${moduleTurnaroundHours} hours, before a customer finds the gap themselves.`,
    },
    {
      key: "data_protection_compliance",
      title: "Data Protection Compliance",
      slug: "data-protection",
      body: `See precisely where your GDPR/PDPL readiness stands — consent, data-subject rights, retention, breach response, cross-border transfer — with a human-reviewed report within ${moduleTurnaroundHours} hours.`,
    },
  ];

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
            <a href="mailto:info@app.elvanis.com" className="hover:text-neutral-900 hover:underline">
              Contact
            </a>
            <Link href="/client-login" className="font-medium text-accent-cta underline hover:text-accent-cta-hover">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* ================= 1. HERO — white ================= */}
      <section className="bg-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-6 sm:py-8">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">For teams running AI in production</p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-5xl">
            Your AI Readiness Review, before they ask.
          </h1>
          {/* Subheadline, 18px/400/#4a4a4a exact (confirmed 2026-09-02,
              item 6) — text-lg is exactly 18px; text-neutral-700 is
              exactly #4a4a4a (was text-neutral-600, #6b6b69, one step
              lighter than requested). */}
          <p className="mt-6 max-w-xl text-lg font-normal leading-relaxed text-neutral-700">
            Get a documented answer for your next procurement questionnaire, security review, or investor question about your
            AI — reviewed by a human, typically ready within {moduleTurnaroundHours} hours.
          </p>

          {/* Exactly one primary CTA + one secondary TEXT link, never two
              competing hero cards (direct instruction). "Book a demo" was
              removed from the hero specifically — it's not gone from the
              page, it keeps its own full section further down (11). */}
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

          {/* Trust bar, 14px/500 (confirmed 2026-09-02, item 6) — was
              text-sm with no explicit weight (inheriting the browser
              default 400); now font-medium (500) explicitly. Checkmark
              stays the true brand --color-accent (#B87333, not
              accent-cta) — a small decorative glyph, not sentence text,
              same "purely decorative accent uses keep the true brand
              color" principle already established in globals.css. */}
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-6">
            {["Evidence-based", "Human-reviewed", `Delivered within ${moduleTurnaroundHours} hours`].map((label) => (
              <div key={label} className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <span aria-hidden="true" className="text-accent">
                  ✓
                </span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 2. THE PROBLEM — #f9f9f9 ================= */}
      <section className="border-t border-neutral-200 bg-background">
        <div className="mx-auto w-full max-w-5xl px-6 py-6">
          <h2 className={SECTION_HEADLINE}>Someone is about to ask about your AI</h2>
          <p className="mt-3 max-w-2xl text-neutral-600">
            Not hypothetically — this is already how AI gets scrutinized in a real deal, a real security review, or a real
            board conversation.
          </p>
          {/* Split layout, 60/40 (confirmed 2026-09-02, layout redesign) —
              lg:grid-cols-5 with a 3/2 column-span split hits exactly
              60%/40%. Left: a real-content styled mockup of the actual
              Path B triage screen (see LandingPageMockups.tsx's own
              docblock for why this is a styled mockup, not a literal
              screenshot). Right: the three trigger types as their own
              compact cards, 16px padding exact (p-4), instead of a third
              equal text column — this was the actual "looks like a blog
              post" problem: three identical text columns with no visual
              hierarchy between the product proof and the supporting
              copy. */}
          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-5 lg:items-start">
            <div className="lg:col-span-3">
              <TriageScreenMockup />
            </div>
            <div className="space-y-4 lg:col-span-2">
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
                <div key={item.title} className="rounded-lg bg-white p-4 shadow-card-1">
                  <h3 className="font-medium text-neutral-900">{item.title}</h3>
                  <p className="mt-2 text-sm text-neutral-600">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-8 max-w-2xl font-medium text-neutral-900">
            Elvanis gives you a documented, evidence-based answer to exactly this — before you&apos;re asked for one.
          </p>
        </div>
      </section>

      {/* ================= 3. THE SOLUTION (new) — white ================= */}
      <section className="border-t border-neutral-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-6">
          <h2 className={SECTION_HEADLINE}>Evidence in. Human-reviewed findings out. No generic advice.</h2>
          <p className="mt-3 max-w-2xl text-neutral-600">
            You submit real evidence — a document, or a short guided form. We tell you what&apos;s safe, what&apos;s
            genuinely missing, and what to fix first. A human checks every word before you see it.
          </p>
          {/* Bento layout (confirmed 2026-09-02, layout redesign) — one
              featured, full-width card for "What's genuinely missing"
              (the deterministic-guarantee differentiator, arguably the
              single most load-bearing claim on the page) with a real
              finding-card mockup inside it, then "What's safe"/"What to
              fix first" as two smaller, equal side-by-side cards below —
              replacing three visually-identical cards that gave the
              actual differentiator no more weight than its two
              supporting points.

              Gap to the subheadline above tightened mt-10 (40px) → mt-8
              (32px), confirmed 2026-09-02 — the only spacing gap flagged
              on the page this round, kept at the top of the requested
              24-32px band rather than the tighter floor, since this is
              the transition into the section's single most load-bearing
              card, not an ordinary intra-section gap. */}
          <div className="mt-8 grid gap-6">
            <div className="rounded-lg bg-white p-6 shadow-card-1 sm:p-8">
              <h3 className="text-lg font-medium text-neutral-900">What&apos;s genuinely missing</h3>
              <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                If you don&apos;t have the documentation, trace logs, or a specific answer, that gap becomes a flagged
                finding automatically — guaranteed in code, never left to an AI&apos;s discretion to remember.
              </p>
              <div className="mt-5 max-w-xl">
                <FindingCardMockup />
              </div>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-lg bg-white p-5 shadow-card-1">
                <h3 className="font-medium text-neutral-900">What&apos;s safe</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Genuine findings that show something is fine get reported as fine — never padded with invented risk to
                  look more thorough than the evidence supports.
                </p>
              </div>
              <div className="rounded-lg bg-white p-5 shadow-card-1">
                <h3 className="font-medium text-neutral-900">What to fix first</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  Every finding carries a real severity and a concrete recommended action, so you know what actually needs
                  attention now versus what can wait.
                </p>
              </div>
            </div>
          </div>
          {/* Copper callout, exact spec (confirmed 2026-09-02) —
              px-5/py-4 is exactly 20px/16px, border-l-[3px]/#B87333 and
              text-[15px] are arbitrary values used deliberately since
              Tailwind's default scale has no native 3px border-width or
              15px text-size step. */}
          <div className="mt-8 border-l-[3px] border-[#B87333] bg-[#fffbf0] px-5 py-4">
            <p className="text-[15px] font-semibold text-neutral-900">
              Every one of these is accepted, edited, or rejected by a human reviewer before it ever reaches you — enforced
              at the system level, not a policy we just say we follow.
            </p>
          </div>
        </div>
      </section>

      {/* ================= 4. WHY US — #f9f9f9 ================= */}
      <section className="border-t border-neutral-200 bg-background">
        <div className="mx-auto w-full max-w-5xl px-6 py-6">
          <h2 className={SECTION_HEADLINE}>Built so you&apos;re ready before they ask.</h2>
          {/* Trust checklist, not a feature grid (confirmed 2026-09-02,
              layout redesign) — three horizontal rows instead of three
              equal cards, since "always human-reviewed / missing
              evidence is itself a finding / source-agnostic evidence"
              are guarantees to check off, not features to compare
              side by side. h-10 w-10 = exactly 40x40px; the circle uses
              accent-cta rather than the true brand accent — a small
              numeral inside a 40px circle is closer to icon-scale than
              body text, but using the already-WCAG-safe accessible
              copper removes any doubt rather than re-litigating the
              large-text exception a third time on this page. divide-y
              gives the full-width divider between rows. */}
          <div className="mt-10 divide-y divide-neutral-200">
            {[
              {
                n: "1",
                title: "Always human-reviewed",
                body: "A human reviewer accepts, edits, or rejects every single AI-drafted finding before it's ever shown to you. This is enforced at the system level, not a policy we just say we follow.",
              },
              {
                n: "2",
                title: "Missing evidence is itself a finding",
                body: "If you don't have documentation, trace logs, or a specific answer, that gap gets flagged automatically — guaranteed in code, never a silent gap in your report.",
              },
              {
                n: "3",
                title: "Source-agnostic evidence",
                body: "Upload a document (we extract the text automatically) or fill in a short guided form — no forced integrations, no OAuth handoff to a tool you don't already trust.",
              },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-5 py-6 first:pt-0 last:pb-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-cta text-base font-semibold text-white">
                  {item.n}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">{item.title}</h3>
                  <p className="mt-1 text-sm text-neutral-700">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= 5. MODULES (Feature-Benefit rewrite) — white ================= */}
      <section id="modules" className="border-t border-neutral-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-6">
          <h2 className={SECTION_HEADLINE}>Three reviews. One matched to what&apos;s actually at stake.</h2>
          <p className="mt-3 max-w-2xl text-neutral-600">
            Whichever one applies to you, the process is the same: real evidence in, human-reviewed findings out — never a
            generic checklist.
          </p>
          {/* Level 2 elevation (confirmed 2026-09-02, item 3) —
              shadow-card-2 is exactly 0 4px 12px rgba(0,0,0,0.10), the
              requested value verbatim. Price at 20px/600 uses the TRUE
              brand --color-accent (#B87333) rather than accent-cta —
              confirmed this specific case clears WCAG AA's 3:1 large-text
              threshold (20px/600 vs white computes to ~3.79:1), unlike
              the smaller 14px button text below, which still needs
              accent-cta to clear the stricter 4.5:1 normal-text minimum.
              "Request this review" button added here (previously only on
              the Pricing section's own compact copy of these cards) —
              same routing/slugs, same accessible-copper substitution. */}
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {MODULES.map((mod) => {
              const price = pricingByKey.get(mod.key);
              return (
                <div key={mod.key} className="flex flex-col rounded-lg border border-neutral-200 bg-white p-6 shadow-card-2">
                  <h3 className="font-medium text-neutral-900">{mod.title}</h3>
                  <p className="mt-2 text-sm text-neutral-600">{mod.body}</p>
                  {price && <p className="mt-4 text-xl font-semibold text-accent">{formatPrice(price)}</p>}
                  <Link
                    href={`/client-login?module=${mod.slug}`}
                    className="mt-4 inline-block self-start rounded-md border border-accent-cta px-4 py-2 text-sm font-medium text-accent-cta hover:bg-accent-cta hover:text-white"
                  >
                    Request this review
                  </Link>
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
        </div>
      </section>

      {/* ================= 6. HOW IT WORKS (AI Audit path primary) — #f9f9f9 =================
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
      <section id="how-it-works" className="border-t border-neutral-200 bg-background">
        <div className="mx-auto w-full max-w-5xl px-6 py-6">
          <h2 className={SECTION_HEADLINE}>How your AI Readiness Review actually works</h2>
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
        </div>
      </section>

      {/* ================= 7. INTERACTIVE DEMO — Slate Onyx #1C2033 =================
          Deliberately wider than every other section (confirmed
          2026-09-01/02, direct instruction: "the widest, most visually
          prominent section on the page after the hero") — its own
          max-w-7xl inner column, same full-bleed-section pattern as
          every other section on this page.
          Background changed from the light #f5f5f4 wash to dark Slate
          Onyx #1C2033 (confirmed 2026-09-02, item 5) — every text
          element directly in this section (not inside the white active-
          step panel, which "stays white with shadow" per explicit
          instruction) recolored to white/neutral-200 (#e8e8e8 exact).
          The "See it work..." heading is a deliberate, disclosed
          resolution of a real conflict between item 4 (this headline
          should be #1a1a1a like every other section headline) and item
          5 (text in this section must be white/light-grey) — item 5's
          explicit per-section color rule wins for color, item 4's size/
          weight (30px/700) still applies, since #1a1a1a text on #1C2033
          would be almost invisible. */}
      <section id="see-it-work" className="border-t border-neutral-200 bg-[#1C2033]">
        <div className="mx-auto w-full max-w-7xl px-6 py-6">
          <h2 className="text-3xl font-bold text-white">See it work — no sign-in, no leaving this page</h2>
          <p className="mt-3 max-w-2xl text-neutral-200">
            Click any step, use the arrows, or just let it play. Step 4 shows real, verbatim findings from an actual delivered
            review.
          </p>
          <div className="mt-8">
            <InteractiveDemoSection steps={AI_READINESS_DEMO_STEPS} />
          </div>
        </div>
      </section>

      {/* ================= 8. EXECUTION AUDIT (secondary, condensed) — white =================
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
      <section id="execution-audit" className="border-t border-neutral-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-6">
          <h2 className={SECTION_HEADLINE}>Not about AI specifically? Try the Execution Audit.</h2>
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
            <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-card-1">
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
        </div>
      </section>

      {/* ================= 9. PRICING (mirrors the in-app Services page) — #f9f9f9 ================= */}
      <section id="pricing" className="border-t border-neutral-200 bg-background">
        <div className="mx-auto w-full max-w-5xl px-6 py-6">
          <h2 className={SECTION_HEADLINE}>Pricing</h2>
          <p className="mt-3 max-w-2xl text-neutral-600">
            Real, live pricing — the same numbers shown inside the product, not a sales-call-to-find-out.
          </p>

          <div className="mt-10 space-y-10">
            <div>
              <h3 className="mb-4 text-base font-semibold text-neutral-900">Execution Audit</h3>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="flex flex-col rounded-lg border-2 border-neutral-300 bg-white p-6">
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
                <div className="flex flex-col rounded-lg border-2 border-accent bg-white p-6">
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
              {/* Per-module "Request this review" CTA (confirmed
                  2026-09-02, direct founder fix) — these three cards
                  previously showed price/turnaround only, no action.
                  "Copper outline" here uses --color-accent-cta (#9c612b),
                  not the literal #B87333 given in the spec — the same
                  accessible substitution already applied to every other
                  copper CTA on this page (see globals.css's own
                  disclosure comment): raw #B87333 text/border on a white
                  background measures ~3.79:1, failing the WCAG AA 4.5:1
                  minimum for normal text, which is exactly why
                  accent-cta exists. rounded-md (6px) used specifically
                  here to match the requested border-radius precisely,
                  even though most other buttons on this page use the
                  default rounded (4px). Query-param slugs match the
                  founder's own given examples exactly. */}
              <div className="grid gap-6 sm:grid-cols-3">
                {MODULES.map((mod) => {
                  const price = pricingByKey.get(mod.key);
                  return (
                    <div key={mod.key} className="flex flex-col rounded-lg border border-neutral-200 bg-white p-6">
                      <p className="font-medium text-neutral-900">{mod.title}</p>
                      {price && <p className="mt-2 text-2xl font-semibold text-neutral-900">{formatPrice(price)}</p>}
                      <p className="mt-2 text-xs text-neutral-500">Human-reviewed, typically within {moduleTurnaroundHours} hours.</p>
                      <Link
                        href={`/client-login?module=${mod.slug}`}
                        className="mt-4 inline-block self-start rounded-md border border-accent-cta px-4 py-2 text-sm font-medium text-accent-cta hover:bg-accent-cta hover:text-white"
                      >
                        Request this review
                      </Link>
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
        </div>
      </section>

      {/* ================= 10. FAQ — white =================
          Not explicitly listed in item 4/1's own section lists — extended
          the established alternation pattern here deliberately (see
          SECTION_HEADLINE's own docblock for the same reasoning applied
          to headline sizing). */}
      <section id="faq" className="border-t border-neutral-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-6">
          <h2 className={SECTION_HEADLINE}>Frequently asked questions</h2>
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
        </div>
      </section>

      {/* ================= 11. CONTACT US / BOOK A DEMO (preserved, per explicit instruction) — #f9f9f9 ================= */}
      <section className="border-t border-neutral-200 bg-background">
        <div className="mx-auto w-full max-w-5xl px-6 py-6">
          <h2 className={SECTION_HEADLINE}>Not ready to submit evidence yet? Talk it through first.</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 bg-white p-6">
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
            <div className="rounded-lg border border-neutral-200 bg-white p-6">
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
        </div>
      </section>

      {/* ================= 12. FINAL CTA + FOOTER — copper wash #FDF6EE =================
          The outer section now carries the exact requested wash color;
          the inner card switched from its own near-identical cream
          (#fffbf0) to plain white, so it reads as a real card floating
          on a matching-toned zone — the same "white panel on a colored
          zone" pattern already proven for the dark demo section above,
          rather than two near-identical creams flattening into one
          undifferentiated block. */}
      <section className="border-t border-neutral-200 bg-[#FDF6EE]">
        <div className="mx-auto w-full max-w-5xl px-6 py-6">
          <div className="rounded-lg border-l-4 border-accent bg-white p-8 text-center shadow-card-2">
            <h2 className={SECTION_HEADLINE}>Would your AI pass a real review?</h2>
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
        </div>
      </section>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200 bg-background px-6 py-6 text-xs text-neutral-500">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4">
          <span>© {new Date().getFullYear()} Elvanis</span>
          <div className="flex gap-4">
            <a href="mailto:info@app.elvanis.com" className="hover:underline">
              Contact us
            </a>
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
        </div>
      </footer>
    </div>
  );
}
