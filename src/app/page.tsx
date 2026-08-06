import Link from "next/link";

/**
 * Real landing page (confirmed 2026-08-06) — the actual public front
 * door. Replaces the untouched create-next-app default scaffold that sat
 * at "/" until now (Next.js logo, "Deploy Now" button, "edit page.tsx"
 * copy — confirmed live in the browser before this change). Genuinely new
 * work, not a design-audit fix: nothing built so far served this purpose.
 *
 * Deliberately kept in the same grayscale, no-brand-color visual language
 * already used throughout the rest of the app (neutral-* borders,
 * black/white buttons) rather than introducing a new color scheme
 * unprompted — that's a real open question from the visual design audit
 * (no brand color exists anywhere in this codebase), not something to
 * decide unilaterally while building this page. If a brand color gets
 * chosen later, this page should be revisited to match.
 *
 * "Start your free audit" routes to /client-login, not directly to
 * /onboarding — a cold visitor needs to authenticate first regardless,
 * and /onboarding itself already redirects an unauthenticated visitor to
 * /client-login, so this is the more honest first step, not a shortcut.
 */
export default function LandingPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-lg font-semibold tracking-tight">Elvanis</span>
        <Link href="/client-login" className="text-sm text-neutral-600 underline hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
          Sign in
        </Link>
      </header>

      <section className="py-16 sm:py-24">
        <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-5xl dark:text-neutral-50">
          Know your top 3 execution priorities — and what they&apos;re costing you.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
          Elvanis is a goal-driven execution audit for founder-led B2B teams. Tell us what you&apos;re optimizing
          for, submit your evidence, and get back your top 3 bottlenecks — each with a financial impact estimate
          and a 30/60/90 day roadmap. Every finding is reviewed by a human before you ever see it.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/client-login"
            className="rounded bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Start your free audit
          </Link>
          <span className="text-sm text-neutral-500 dark:text-neutral-400">Your first completed audit is free. No card required.</span>
        </div>
      </section>

      <section className="border-t border-neutral-200 py-16 dark:border-neutral-800">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
          One goal. Five independent lenses. No fluff.
        </h2>
        <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
          You pick the outcome that matters most right now — cash flow, growth, retention, execution speed, or
          product delivery. Every lens reads that goal and weighs its findings against it, so the audit stays
          focused on what actually moves the number you care about, not a generic checklist.
        </p>
        <dl className="mt-10 grid gap-8 sm:grid-cols-2">
          {[
            {
              title: "Financial",
              body: "Margin, runway, cost structure, and customer concentration — benchmarked against real thresholds, not vibes.",
            },
            {
              title: "Commercial / Market",
              body: "What you're telling us about competitors and pricing pressure, checked against independent research on the same companies.",
            },
            {
              title: "Execution / Operating",
              body: "How fast decisions and delivery actually move — meeting load, cycle time, and the process drag behind them.",
            },
            {
              title: "Product / Customer",
              body: "Usage, adoption, satisfaction, and churn signals, read as a product-fit problem — not a financial or process one.",
            },
            {
              title: "AI & Governance",
              body: "How mature your AI use and oversight actually are, scored against a real 7-dimension maturity framework.",
            },
          ].map((lens) => (
            <div key={lens.title}>
              <dt className="font-medium text-neutral-900 dark:text-neutral-50">{lens.title}</dt>
              <dd className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{lens.body}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-neutral-200 py-16 dark:border-neutral-800">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">How it works</h2>
        <ol className="mt-8 grid gap-8 sm:grid-cols-3">
          {[
            { step: "1", title: "Submit your evidence", body: "Fill in what you can per lens — your own native exports or a short guided form. Leaving something blank is meaningful too." },
            { step: "2", title: "We draft, a human reviews", body: "Five AI lenses draft findings independently. A reviewer accepts, edits, or rejects every single one before anything reaches you — nothing client-facing is AI-only." },
            { step: "3", title: "Get your report", body: "Your top 3 priorities, each with a financial impact estimate, plus a 30/60/90 day roadmap — ready within 72 hours." },
          ].map((s) => (
            <li key={s.step}>
              <span className="text-sm font-medium text-neutral-400">{s.step}</span>
              <h3 className="mt-1 font-medium text-neutral-900 dark:text-neutral-50">{s.title}</h3>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-t border-neutral-200 py-16 dark:border-neutral-800">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">Your data, handled honestly</h2>
        <ul className="mt-6 max-w-2xl space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
          <li>· What you submit is analyzed by a named AI provider (Groq) to draft findings — we tell you exactly who, not just &quot;AI.&quot;</li>
          <li>· Every finding is reviewed and approved by a human before it&apos;s ever shown to you. Nothing client-facing is AI-only.</li>
          <li>· We never share your evidence with any other third party, and it&apos;s never used to train any AI model.</li>
          <li>· You can request deletion of your data at any time.</li>
        </ul>
        <p className="mt-6 text-sm text-neutral-500 dark:text-neutral-400">
          Full detail in our{" "}
          <Link href="/privacy" className="underline hover:text-neutral-900 dark:hover:text-neutral-100">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="underline hover:text-neutral-900 dark:hover:text-neutral-100">
            Terms of Service
          </Link>
          .
        </p>
      </section>

      <section className="border-t border-neutral-200 py-16 dark:border-neutral-800">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Ready to see where you actually stand?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
            Your first completed audit is free. No card required to start.
          </p>
          <Link
            href="/client-login"
            className="mt-6 inline-block rounded bg-neutral-900 px-5 py-3 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
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
            Sign in
          </Link>
          <Link href="/reviewer-login" className="hover:underline">
            Reviewer sign-in
          </Link>
        </div>
      </footer>
    </div>
  );
}
