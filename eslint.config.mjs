import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Formalizes a convention already used in the codebase (e.g. the
    // not-yet-implemented Phase 2 stubs in template-library.ts/generator.ts)
    // — a leading underscore signals a deliberately unused parameter,
    // rather than needing an inline eslint-disable per stub.
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright's own generated output (confirmed 2026-09-02) — the HTML
    // report bundles Playwright's own vendored trace-viewer JS, and
    // test-results/ holds raw run artifacts; neither is our source.
    "tests/e2e/report/**",
    "tests/e2e/screenshots/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
