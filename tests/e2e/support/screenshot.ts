import type { Page, TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * One consistent screenshot location/naming convention across every spec
 * — confirmed 2026-09-02 — so a full run's output can be gathered and
 * reviewed as one coherent set (`tests/e2e/screenshots/<flow>/<NN-step>-
 * <project>.png`), not scattered ad hoc paths per spec file.
 */
export async function step(page: Page, testInfo: TestInfo, flow: string, name: string) {
  const path = `tests/e2e/screenshots/${flow}/${name}-${testInfo.project.name}.png`;
  mkdirSync(dirname(path), { recursive: true });
  await page.screenshot({ path, fullPage: true });
  return path;
}
