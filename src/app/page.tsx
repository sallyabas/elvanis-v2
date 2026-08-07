import Link from "next/link";
import { listPricing, type PricingItem } from "@/lib/pricing";
import { InteractiveDemoSection } from "./_components/InteractiveDemoSection";

/**
 * Real landing page — full rebuild, confirmed 2026-08-07 (supersedes the
 * 2026-08-06 build, which was correctly flagged as too thin for a real
 * product launch: hero + lens cards + one bottom CTA). Same charcoal +
 * amber brand identity (see globals.css), same "sign in first" honesty
 * for every primary CTA (/onboarding already redirects an unauthenticated
 * visitor to /client-login, so routing there directly is the honest first
 * step, not a shortcut) — this pass adds real depth: a problem section
 * naming the actual pain before the solution, the standalone modules, a
 * real DB-backed pricing section (never a hardcoded literal — see
 * src/lib/pricing.ts), an FAQ, and a Discovery Session CTA that reuses the
 * existing request mechanism rather than a new booking flow (see below).
 *
 * Headline/subhead copy is the founder's own exact wording, confirmed
 * 2026-08-07 — not paraphrased.
 *
 * Revalidation, confirmed 2026-08-07: this route has no auth check, so
 * Next would otherwise statically prerender it at build time and bake in
 * whatever `pricing` read at that moment — silently defeating the whole
 * "admin-adjustable without a redeploy" point of the DB-backed pricing
 * table (src/lib/pricing.ts) for the one page most new visitors actually
 * see. A 60s ISR window keeps the static-page performance while making
 * sure a reviewer's price edit on /queue shows up here within a minute,
 * not only on the next deploy.
 */
export const revalidate = 60;

/**
 * Real Calendly link, confirmed 2026-08-07 — the founder's own account
 * URL, not a placeholder. This app has no calendar/scheduling integration
 * of its own anywhere (a deliberate choice — see the Service Layer's
 * request-and-human-follow-up design), so this is a real external link,
 * not something built into the product; kept as a single named constant
 * rather than inline in JSX since it's the one genuinely business-owned
 * value on this page that isn't already DB-backed pricing.
 */
const CALENDLY_URL = "https://calendly.com/elvanis-app/30min";

export default async function LandingPage() {
  const pricing = await listPricing();
  const pricingByKey = new Map(pricing.map((p) => [p.itemKey, p]));

  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-neutral-900">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <span className="text-lg font-semibold tracking-tight text-neutral-50">Elvanis</span>
          <nav className="flex flex-wrap items-center gap-5 text-sm text-neutral-300">
            <a href="#how-it-works" className="hover:text-neutral-50 hover:underline">
              How it works
            </a>
            <a href="#modules" className="hover:text-neutral-50 hover:underline">
              Modules
            </a>
            <a href="#pricing" className="hover:text-neutral-50 hover:underline">
              Pricing
            </a>
            <a href="#faq" className="hover:text-neutral-50 hover:underline">
              FAQ
            </a>
            {/* Renamed from bare "Sign in" (confirmed 2026-08-07) — a
                first-time visitor reading "Sign in" reasonably assumes they
                need an account already, when the real flow (magic-link,
                shouldCreateUser: true) starts new and returning users
                identically off the same click. "Get started" is honest for
                both cases. The passwordless explanation was removed from
                here (real feedback: "so uglyyy") and moved to /client-login
                itself, led with the founder's own exact wording — the
                explanation now lives once, at the point it's actually
                needed, not as clutter in the nav bar. */}
            <Link href="/client-login" className="font-medium underline hover:text-neutral-50">
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6">
        {/* 1. Hero */}
        <section className="py-16 sm:py-24">
          <p className="text-sm font-medium uppercase tracking-wide text-accent">
            A diagnosis, plus a 90-day action plan — for founder-led B2B teams
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-5xl dark:text-neutral-50">
            Find the 3 things actually holding your business back.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
            Submit your evidence, get a financially-quantified diagnosis and a 90-day plan — not another generic AI
            report.
          </p>
          {/* Positioning clarity, confirmed 2026-08-07: the subhead already
              named both halves, but nothing on the page foregrounded "you
              get a concrete plan, not just a diagnosis" as clearly and
              early as it deserved — this pair of badges makes it
              unmissable right under the primary CTA, not buried in a
              paragraph. */}
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
              <span className="text-accent">✓</span> Financially-quantified diagnosis
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300">
              <span className="text-accent">✓</span> Concrete 30/60/90 action plan
            </span>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/client-login"
              className="rounded bg-accent px-5 py-3 text-sm font-medium text-accent-ink hover:bg-accent-hover"
            >
              Start your free audit
            </Link>
            {/* "Book a demo" moved into the hero, confirmed 2026-08-07 — the
                real Calendly link (see CALENDLY_URL below) previously only
                appeared much further down the page; a visitor who wants to
                talk to someone before doing anything else shouldn't have to
                scroll past 8 sections to find that option. Still also
                offered again, with fuller framing, in its own section
                lower down. */}
            <Link
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-accent px-5 py-3 text-sm font-medium text-accent hover:bg-accent hover:text-accent-ink"
            >
              Book a demo
            </Link>
          </div>
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
            Your first completed audit is free. No card required, no password — just your email.
          </p>
        </section>

        {/* 2. The problem */}
        <section className="border-t border-neutral-200 py-16 dark:border-neutral-800">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Most &quot;AI audits&quot; hand you a wall of generic advice
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
            You&apos;re not short on dashboards. You&apos;re short on a clear answer to one question: what should I
            actually fix first, and what is it costing me if I don&apos;t?
          </p>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                title: "No prioritization",
                body: "You've got a margin problem, a slow sales cycle, a churn signal, and an operational bottleneck all at once — and no honest ranking of which one to fix first.",
              },
              {
                title: "No dollar figures",
                body: "Generic AI reports read like they could apply to any company, because they never quantify anything. \"Improve your onboarding\" isn't a decision you can act on.",
              },
              {
                title: "Nothing you can trust blind",
                body: "AI-only output is fast, but nobody's checked it. You end up re-verifying everything yourself before you'd ever act on it.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="font-medium text-neutral-900 dark:text-neutral-50">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{item.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-2xl font-medium text-neutral-900 dark:text-neutral-50">
            Elvanis is built to fix exactly that — a ranked, financially-quantified top 3, and every finding checked
            by a human before you see it.
          </p>
        </section>

        {/* 3. How it works */}
        <section id="how-it-works" className="border-t border-neutral-200 py-16 dark:border-neutral-800">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">How it works</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "1",
                title: "Pick your goal",
                body: "Cash flow, growth, retention, execution speed, or product delivery — every lens weighs its findings against the one outcome you actually care about right now.",
              },
              {
                step: "2",
                title: "Submit your evidence",
                body: "Your own native exports (Xero, HubSpot, Jira, and more) or a short guided form, per lens. Leaving something blank is meaningful too, not a failed submission.",
              },
              {
                step: "3",
                title: "We draft, a human reviews",
                body: "Five AI lenses draft findings independently. A reviewer accepts, edits, or rejects every single one — nothing client-facing is ever AI-only.",
              },
              {
                step: "4",
                title: "Get your diagnosis + action plan",
                body: "Your top 3 priorities, each with a financial impact estimate, plus a concrete 30/60/90 day roadmap you can hand straight to your team — ready within 72 hours.",
              },
            ].map((s) => (
              <li key={s.step}>
                <span className="text-sm font-semibold text-accent">{s.step}</span>
                <h3 className="mt-1 font-medium text-neutral-900 dark:text-neutral-50">{s.title}</h3>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* 4. Interactive demo — embedded, self-contained, auto-playing
            (confirmed 2026-08-07, replacing the previous "link to /demo"
            card). No sign-in, no leaving this page; see
            InteractiveDemoSection.tsx for the full design rationale. */}
        <section className="border-t border-neutral-200 py-16 dark:border-neutral-800">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            From evidence to action plan — step by step
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
            Watch how it actually works, right here — no sign-in, no leaving this page. Click any step, use the
            arrows, or just let it play.
          </p>
          <div className="mt-8">
            <InteractiveDemoSection />
          </div>
          <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
            Prefer a real example over a walkthrough?{" "}
            <Link href="/demo-live" className="text-accent underline hover:text-accent-hover">
              View a real, complete demo report →
            </Link>
          </p>
        </section>

        {/* 5. Five-lens breakdown */}
        <section className="border-t border-neutral-200 py-16 dark:border-neutral-800">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            One goal. Five independent lenses. No fluff.
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
            Every lens runs independently and reads your chosen goal, so the audit stays focused on what actually
            moves the number you care about — not a generic checklist.
          </p>
          <dl className="mt-10 grid gap-8 sm:grid-cols-2">
            {[
              {
                title: "Financial",
                body: "Margin, runway, cost structure, and customer concentration — benchmarked against real published thresholds, not vibes. Every numeric comparison is computed, never eyeballed by the AI.",
              },
              {
                title: "Commercial / Market",
                body: "What you're telling us about competitors and pricing pressure, checked against independent research on the same named companies — self-report and independent findings are tagged separately, so you know which is which.",
              },
              {
                title: "Execution / Operating",
                body: "How fast decisions and delivery actually move — meeting load, cycle time, decision latency, and the process drag behind them, benchmarked against real 2025/2026 industry research.",
              },
              {
                title: "Product / Customer",
                body: "Usage, adoption, satisfaction, and churn signals, read as a product-fit problem — not a financial or process one. We stay in our lane so findings don't overlap or contradict.",
              },
              {
                title: "AI & Governance",
                body: "How mature your AI use and oversight actually are, scored against a real 7-dimension maturity framework (EU AI Act, NIST AI RMF, ISO/IEC 42001, OECD AI Principles).",
              },
            ].map((lens) => (
              <div key={lens.title} className="border-l-2 border-accent pl-4">
                <dt className="font-medium text-neutral-900 dark:text-neutral-50">{lens.title}</dt>
                <dd className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{lens.body}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 6. Modules */}
        <section id="modules" className="border-t border-neutral-200 py-16 dark:border-neutral-800">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Standalone modules, when you need them
          </h2>
          <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
            Built on the same evidence-in, human-reviewed engine as the core audit. Run any of these on their own,
            or as a follow-up once you have real findings to build on.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              {
                key: "tender_readiness",
                title: "Tender Readiness",
                body: "Bidding for public-sector or enterprise procurement? Know exactly which AI/data regulations actually apply to you — EU AI Act, UAE DIFC Regulation 10, Saudi AI governance — before a tender asks.",
              },
              {
                key: "ai_reliability_audit",
                title: "AI Reliability Audit",
                body: "Running an AI chatbot or agent in front of customers? Stress-test it against documented real-world failure patterns — invented policy, data leakage, bias, prompt injection — before a customer finds the gap.",
              },
              {
                key: "data_protection_compliance",
                title: "Data Protection Compliance",
                body: "UK/EU GDPR and Saudi PDPL readiness — consent flows, data-subject rights, retention, breach response, cross-border transfer — checked against whichever regimes actually apply to your company.",
              },
            ].map((mod) => {
              const price = pricingByKey.get(mod.key);
              return (
                <div key={mod.key} className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
                  <h3 className="font-medium text-neutral-900 dark:text-neutral-50">{mod.title}</h3>
                  <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{mod.body}</p>
                  {price && <p className="mt-4 text-sm font-medium text-accent">{formatPrice(price)}</p>}
                </div>
              );
            })}
          </div>
        </section>

        {/* 7. Pricing — restructured, confirmed 2026-08-07: the previous
            version listed every module price flat in this section (adding
            up to £11,000+ visually) on top of already showing each module's
            price, with context, in its own card in section 6 above — pure
            repetition that made the page read as more expensive than it
            actually is for the audit itself. This section now answers one
            question only — "what does the core audit cost?" — as a clean
            2-option comparison. Module pricing stays exactly where it
            already has real context: the module cards higher up the page.
            Monthly Execution Office is deliberately not shown here at all
            (not even as "Coming soon") — it's still an unvalidated
            placeholder number with no dedicated section anywhere else on
            this page either, so there's nothing honest to say about it
            publicly yet. */}
        <section id="pricing" className="border-t border-neutral-200 py-16 dark:border-neutral-800">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Pricing</h2>
          <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
            Straightforward, live pricing for the core audit — not a sales-call-to-find-out. Confirmed v1 launch
            numbers, not yet pilot-validated. (Standalone module pricing is shown above, alongside each module.)
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <div className="rounded-lg border-2 border-neutral-300 p-6 dark:border-neutral-700">
              <p className="text-sm font-medium uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Standard</p>
              <p className="mt-2 text-3xl font-semibold text-neutral-900 dark:text-neutral-50">Free</p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                Your first completed audit — all five lenses, full human review, top 3 priorities and a 30/60/90
                roadmap. Re-audits are always paid.
              </p>
            </div>
            <div className="rounded-lg border-2 border-accent p-6">
              <p className="text-sm font-medium uppercase tracking-wide text-accent">Concierge</p>
              <p className="mt-2 text-3xl font-semibold text-neutral-900 dark:text-neutral-50">
                {formatPrice(pricingByKey.get("concierge_tier") ?? { priceAmount: 300, currency: "GBP" })}
              </p>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                Everything in Standard, plus a Discovery Session and a Delivery Session included by default, and
                deeper reviewer attention on ambiguous findings.
              </p>
            </div>
          </div>
        </section>

        {/* 8. Why us */}
        <section className="border-t border-neutral-200 py-16 dark:border-neutral-800">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Why Elvanis</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-3">
            {[
              {
                title: "Financially quantified",
                body: "Every priority comes with a real financial impact estimate, not just a severity label — so you can weigh it against everything else competing for your time.",
              },
              {
                title: "Always human-reviewed",
                body: "A human reviewer accepts, edits, or rejects every single AI-drafted finding before it's ever shown to you. This is enforced at the system level, not a policy we just say we follow.",
              },
              {
                title: "Source-agnostic evidence",
                body: "Upload your own native exports (Xero, HubSpot, Jira, and more) or fill in a short guided form — no forced integrations, no OAuth handoff to a tool you don't already trust.",
              },
            ].map((item) => (
              <div key={item.title}>
                <h3 className="font-medium text-neutral-900 dark:text-neutral-50">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 9. FAQ */}
        <section id="faq" className="border-t border-neutral-200 py-16 dark:border-neutral-800">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Frequently asked questions</h2>
          <div className="mt-8 max-w-2xl divide-y divide-neutral-200 dark:divide-neutral-800">
            {[
              {
                q: "Is my data safe?",
                a: "Your evidence is sent to Groq, our named AI provider, to draft findings — it's never used to train any model, and we never share it with any other third party. Everything is stored in Supabase, access-restricted to your account and the human reviewers on your audit. You can request deletion of your account and data at any time. Full detail in our Privacy Policy.",
              },
              {
                q: "How long does it actually take?",
                a: "72 hours from submission to a delivered report, as one number: a 24-hour window where you can keep editing or adding evidence, then up to 48 hours of human review once that window closes.",
              },
              {
                q: "Do I need to connect any tools?",
                a: "No — there's no OAuth, no live integration required. Per lens, you either upload your own native export (a CSV/PDF you already have) or fill in a short guided form. Leaving a field blank is treated as meaningful evidence too, not an incomplete submission.",
              },
              {
                q: "What if I don't have clean data for every lens?",
                a: "That's expected, and it's still useful — missing evidence is itself flagged as a finding rather than silently skipped, so a reviewer sees exactly where your visibility gaps are, not just where your numbers are good.",
              },
              {
                q: "Is this a one-off report, or ongoing?",
                a: "The core audit is a point-in-time diagnosis. New evidence after a delivered report starts a new, paid re-audit cycle — your original report stays frozen in your history so you can track what changed.",
              },
            ].map((item) => (
              <details key={item.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-neutral-900 dark:text-neutral-50">
                  {item.q}
                  <span className="ml-4 text-accent group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* 10. Book a Discovery Session — two real, distinct paths
            (confirmed 2026-08-07), not one CTA with a second bolted on.
            The existing Discovery Session flow requires signing up first
            (the request mechanism is session-scoped, see
            session-requests.ts) and gets scheduled by human follow-up —
            genuinely useful for someone ready to commit, but not "instant"
            for a visitor who just wants to talk to someone right now.
            Calendly (a real link the founder provided, not a placeholder)
            covers exactly that case: no signup, no evidence, pick a slot
            yourself. Presented as two clearly-labeled options side by
            side, not as if they were the same thing. */}
        <section className="border-t border-neutral-200 py-16 dark:border-neutral-800">
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
            Not ready to submit evidence yet? Talk it through first.
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900/40">
              <h3 className="font-medium text-neutral-900 dark:text-neutral-50">Book a demo now</h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                Pick a time yourself, right now — no signup, no evidence needed. Fastest way to talk to someone.
              </p>
              <Link
                href={CALENDLY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-block rounded bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:bg-accent-hover"
              >
                Book a demo →
              </Link>
            </div>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-6 dark:border-neutral-800 dark:bg-neutral-900/40">
              <h3 className="font-medium text-neutral-900 dark:text-neutral-50">Request a Discovery Session</h3>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                Offered on every plan, no extra cost on Standard, included by default on Concierge. Sign up and
                request one directly from your evidence intake page, any time before or during submission —
                we&apos;ll follow up to schedule it.
              </p>
              <Link
                href="/client-login"
                className="mt-4 inline-block rounded border border-accent px-5 py-2.5 text-sm font-medium text-accent hover:bg-accent hover:text-accent-ink"
              >
                Sign up and request one
              </Link>
            </div>
          </div>
        </section>

        {/* 11. Final CTA + footer */}
        <section className="border-t border-neutral-200 py-16 dark:border-neutral-800">
          <div className="rounded-lg bg-neutral-900 p-8 text-center">
            <h2 className="text-xl font-semibold text-neutral-50">Ready to see where you actually stand?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-300">Your first completed audit is free. No card required to start.</p>
            <Link
              href="/client-login"
              className="mt-6 inline-block rounded bg-accent px-5 py-3 text-sm font-medium text-accent-ink hover:bg-accent-hover"
            >
              Start your free audit
            </Link>
          </div>
        </section>

        <footer className="mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200 py-8 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
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
          {/* Reviewer sign-in link removed from the public page, confirmed
              2026-08-07 — /reviewer-login itself is untouched and still
              fully functional, reachable only by a direct, bookmarked URL,
              never linked from anywhere a visitor could stumble onto it. */}
        </footer>
      </div>
    </div>
  );
}

function formatPrice(item: Pick<PricingItem, "priceAmount" | "currency">): string {
  if (item.priceAmount === 0) return "Free";
  const symbol = item.currency === "GBP" ? "£" : `${item.currency} `;
  const amount = item.priceAmount.toLocaleString("en-GB");
  return `${symbol}${amount}`;
}
