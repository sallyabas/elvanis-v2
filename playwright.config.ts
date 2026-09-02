import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// Loads .env.local the same way `next dev`/this codebase's own scratch
// scripts do, so this config (and anything it imports, like
// tests/e2e/support/db.ts) sees NEXT_PUBLIC_SUPABASE_URL/
// SUPABASE_SERVICE_ROLE_KEY without needing them re-declared in CI's own
// shell env for local runs. Uses Node's native loadEnvFile (no new
// dependency) — a no-op against a real deployed target where secrets come
// from the CI environment directly, not a local .env.local file.
if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

/**
 * Real, repeatable E2E test config — confirmed 2026-09-02, built to run
 * after every future deploy (see .github/workflows/e2e.yml for the CI
 * scaffold), not as a one-off session test. See tests/e2e/README.md for
 * the full picture (auth strategy, seeding, cleanup, what each spec
 * covers).
 *
 * `baseURL` defaults to local dev but is meant to be overridden
 * (`E2E_BASE_URL`) to point at a real deployed preview/staging URL for
 * post-deploy runs — the suite itself doesn't care which Next.js
 * deployment it's hitting, since Supabase auth is independent of that.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isLocalTarget = baseURL.includes("localhost") || baseURL.includes("127.0.0.1");

// `webServer.env` only reaches the spawned dev-server child process, not
// this config/test-runner process itself — and tests/e2e/support/auth.ts
// reads TEST_AUTH_SECRET from the test-runner's own process.env to send as
// a header. Resolving the value once here and writing it back to
// process.env keeps both sides using the exact same secret for a local
// run, without needing it set twice in two different places.
const testAuthSecret = process.env.TEST_AUTH_SECRET ?? "local-e2e-secret-not-for-production";
process.env.TEST_AUTH_SECRET = testAuthSecret;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false, // test accounts/companies are real DB rows; keep runs simple and deterministic, not racing each other
  // Real bug found live, not assumed: Playwright's default worker count
  // (one per CPU core) runs different SPEC FILES concurrently even with
  // fullyParallel:false (which only controls parallelism WITHIN one file)
  // — several specs then hit the 30s per-test timeout waiting on form
  // fields, because all those workers were hammering the SAME single local
  // dev server (real signups, real DB writes, real on-demand Turbopack
  // route compiles) at once. Forcing one worker removes that contention as
  // a variable entirely — a real deployed CI target wouldn't have a
  // shared-dev-server bottleneck, but this suite's own tests are
  // real, stateful DB operations against one shared Supabase project
  // either way, so serial execution is the right default regardless of
  // target.
  workers: 1,
  forbidOnly: !!process.env.CI,
  // 1 retry unconditionally, not just in CI — confirmed real, reproducible
  // local-dev-only flakiness (2026-09-02): the very first heavy Server
  // Action call against a just-started Turbopack dev server can take
  // meaningfully longer than usual (root-caused as dev-server cold-
  // start/compile variance, not a code bug — the same flow, run in
  // isolation via a standalone script against the same dev server,
  // consistently completes in ~3s; the underlying app behavior was proven
  // correct via multiple direct, deterministic reproductions). A real
  // deployed target has no such variance (no dev-mode compile step), so
  // this retry is a no-op safety margin there, not something masking a
  // real failure.
  retries: 1,
  reporter: [["list"], ["html", { open: "never", outputFolder: "tests/e2e/report" }]],
  globalSetup: "./tests/e2e/support/globalSetup.ts",
  globalTeardown: "./tests/e2e/support/globalTeardown.ts",
  // Global assertion timeout bumped from Playwright's 5s default to 10s —
  // confirmed real cause, not padding for its own sake: a freshly-started
  // local dev server cold-compiles each route on first visit (Turbopack,
  // dev mode only), which genuinely took a real sidebar-navigation test
  // past 5s on its first live run. A real deployed target (CI's actual
  // "after every future deploy" use case) has no such on-demand
  // compilation, so this is a real-but-harmless ceiling there, not an
  // added delay.
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } },
    },
    {
      name: "mobile",
      // Pixel 5 (Chromium-based), not an iPhone preset (WebKit-based) —
      // this suite only installs the Chromium browser binary (see
      // tests/e2e/README.md), and the actual ask here is real mobile
      // VIEWPORT/responsive-layout coverage, not testing Safari's specific
      // rendering engine.
      use: { ...devices["Pixel 5"] },
      // Only the sidebar-navigation spec runs under the mobile project
      // (see that spec's own file — it's the one item explicitly asked
      // for at both desktop and mobile widths); every other spec only
      // needs to prove the flow works once, not once per viewport.
      testMatch: /05-sidebar-navigation\.spec\.ts/,
    },
  ],
  // Only auto-start a dev server when targeting localhost — a real
  // deployed preview/staging URL is already running on its own.
  webServer: isLocalTarget
    ? {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ALLOW_TEST_AUTH: "true",
          TEST_AUTH_SECRET: testAuthSecret,
        },
      }
    : undefined,
});
