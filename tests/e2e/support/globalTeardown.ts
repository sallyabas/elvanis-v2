import { cleanupTestData } from "./cleanup";

/**
 * Runs once after the whole suite — confirmed 2026-09-02. Real deletion of
 * every account this run created, so nothing accumulates on the real
 * Supabase project run after run, run after future deploy.
 */
export default async function globalTeardown() {
  const { deletedCount } = await cleanupTestData();
  // eslint-disable-next-line no-console
  console.log(`[globalTeardown] Deleted ${deletedCount} E2E test account(s) created by this run.`);
}
