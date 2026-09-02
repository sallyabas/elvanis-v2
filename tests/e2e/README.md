# Playwright E2E suite

Real, repeatable end-to-end infrastructure — confirmed 2026-09-02, built to run after every future deploy, not as a one-off session test.

## What's covered

1. **`01-landing-page.spec.ts`** — public landing page loads, every primary CTA is visible with the correct destination.
2. **`02-path-a-signup.spec.ts`** — Path A: signup → 5-step onboarding wizard → Evidence Intake → store-only submit → Dashboard.
3. **`03-path-b-triage.spec.ts`** — Path B: 5-field profile + real triage UI for one branch, plus the other three triage-answer combinations exercised directly against `/ai-audit`'s real rendering (see the spec's own docblock for why) → Dashboard.
4. **`04-hub-path.spec.ts`** — "I'm not sure yet" → minimal-name bridge → Hub screen → attaches onto the Business Diagnosis wizard.
5. **`05-sidebar-navigation.spec.ts`** — Dashboard → every sidebar destination and back, run under both the `desktop` and `mobile` Playwright projects.
6. **`06-reviewer-approval-delivery.spec.ts`** — a real reviewer Accept/Edit/Approve/Deliver cycle against a seeded report, then the client viewing their delivered report.

## The auth problem, and how this suite solves it

This app is 100% passwordless (magic-link + 6-digit code, no passwords anywhere) — a real test can't click a link in a real inbox. `src/app/api/test/auth/route.ts` is a small, permanent, **double-gated** route (see its own docblock for the full reasoning) that establishes a real session for a given email using the exact mechanism this codebase's own manual test passes have used all along (`admin.generateLink()` + `verifyOtp()` through the app's real cookie-writing code path) — a genuine session, not a mock.

It 404s unless **both** `ALLOW_TEST_AUTH=true` **and** a matching `x-test-auth-secret` header are present. **`ALLOW_TEST_AUTH` must never be set on the production Vercel project** — only on local dev or a dedicated preview/staging deployment this suite targets, same operational treatment as `CRON_SECRET` already gets elsewhere in this codebase.

`tests/e2e/support/auth.ts`'s `loginAsTestUser(page, email)` is the one helper every spec uses to call this route.

## Test data: namespacing and cleanup

Every test account lives under `@elvanis-pw-e2e.test` (`tests/e2e/support/testEmail.ts`). `tests/e2e/support/cleanup.ts` deletes every `auth.users` row under that domain — cascading foreign keys (`users` → `companies` → `reports`/`goals`/`lens_findings`/...) handle everything downstream automatically, confirmed by reading the schema directly rather than assumed. This runs as both `globalSetup` (clean slate before a run, in case a prior run crashed mid-suite) and `globalTeardown` (clean up after), so nothing accumulates on the real Supabase project run after run.

Run it manually any time with `npm run test:e2e:cleanup`.

## Item 6's seeded data — a disclosed interpretation

Item 6 asks for findings covering "one CRITICAL with a quantified financial impact, one HIGH, one MEDIUM, one Article 4 AI literacy finding." The real "Article 4" deterministic guarantee lives specifically in the Tender Readiness **module** (`buildArticle4LiteracyFinding()`), not the five core lenses this test's `reports`/`lens_findings` cycle exercises. Seeding it as a literal module finding would mean also driving a second reviewer workspace (`/review-module/[id]`) that item 6's own description doesn't otherwise mention. `tests/e2e/support/seed.ts` instead seeds a real `ai_governance`-lens finding whose content mirrors the same concern (no AI literacy training for staff using AI tools) — satisfying the requested severity/content mix without silently expanding this test's scope. Flag this back if a literal Tender Readiness module test was actually intended.

## Running locally

```bash
npm run test:e2e
```

Auto-starts `npm run dev` against `http://localhost:3000` with `ALLOW_TEST_AUTH=true` injected only into that spawned process (see `playwright.config.ts`'s `webServer.env` — this never touches how you'd normally run `npm run dev` yourself). `npm run test:e2e:ui` opens Playwright's interactive UI mode; `npm run test:e2e:report` opens the last HTML report.

## Running against a real deployed URL (the actual "after every future deploy" use case)

```bash
E2E_BASE_URL=https://your-preview-url.vercel.app TEST_AUTH_SECRET=... npm run test:e2e
```

`ALLOW_TEST_AUTH=true` and a matching `TEST_AUTH_SECRET` must already be set as real env vars on **that specific deployment** (never on the production domain) — this suite doesn't set them for you when targeting a real deployed URL, only when it starts its own local dev server.

## CI

`.github/workflows/e2e.yml` is a real, runnable scaffold — **not yet wired to fire automatically**. It needs real secrets configured in GitHub (`TEST_AUTH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `E2E_BASE_URL` pointed at whatever preview/staging deployment gets `ALLOW_TEST_AUTH=true`) before it can actually run — same `gh secret set` pattern already used for this repo's existing cron workflow. Flagged here explicitly rather than assumed done.

## Screenshots

Every spec takes explicit screenshots at each meaningful step via `tests/e2e/support/screenshot.ts`, written to `tests/e2e/screenshots/<flow>/<NN-step>-<project>.png` — not just Playwright's own on-failure captures (`use.screenshot: "only-on-failure"` in the config, kept as a real safety net on top).
