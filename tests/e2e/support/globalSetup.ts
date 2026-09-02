import { cleanupTestData } from "./cleanup";

/**
 * Runs once before the whole suite — confirmed 2026-09-02. Cleans up any
 * stale test data left behind by a crashed prior run, so this run starts
 * from a genuinely clean slate rather than silently accumulating on top of
 * leftovers.
 */
export default async function globalSetup() {
  const { deletedCount } = await cleanupTestData();
  if (deletedCount > 0) {
    // eslint-disable-next-line no-console
    console.log(`[globalSetup] Cleaned up ${deletedCount} stale E2E test account(s) from a prior run.`);
  }
}
