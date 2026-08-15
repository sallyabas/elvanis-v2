import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Real, multi-attempt bug history, resolved 2026-08-15 by removing the
   * problematic dependency instead of continuing to configure around it —
   * kept here as the record, since two earlier fix attempts in this same
   * spot were each reported (correctly) as still broken:
   *
   * 1. A real Turbopack dev-mode bug (pdf-parse/pdfjs-dist's dynamic
   *    `import(this.workerSrc)` worker-loading call has no Turbopack
   *    equivalent of its webpack/vite `/*webpackIgnore*\/` hint) was fixed
   *    here via `serverExternalPackages: ["pdf-parse", "pdfjs-dist"]` —
   *    confirmed correct for local `next dev`/`npm run build`, but that
   *    never exercised Vercel's own deployment-time file tracing.
   * 2. A follow-up production 500 (raw, uncaught, "Server Components
   *    render" error, reported live from the deployed site) was treated as
   *    a Vercel file-tracing gap and "fixed" with an `outputFileTracingIncludes`
   *    entry for pdf-parse/pdfjs-dist's `.mjs` files, paired with a
   *    defensive try/catch. The exact same raw 500 was reported again
   *    after that deployed — that fix did not work.
   *
   * Root cause, confirmed via published external sources rather than
   * guessed a third time (see extract-text.ts's own docblock for the full
   * writeup + sources): pdf-parse's pdfjs-dist dependency has an OPTIONAL
   * native dependency on `canvas`, which needs Python/node-gyp/a C++
   * toolchain to compile — none of which exist in Vercel's serverless
   * environment. This is a documented, recurring failure class for this
   * library on Vercel specifically, not a bundler-config problem.
   *
   * Fixed by removing pdf-parse entirely and switching to `unpdf` (see
   * extract-text.ts), which ships its own zero-native-dependency
   * serverless-compiled PDF.js build and needs no special Next.js config —
   * both entries below are removed as a result, since nothing in this
   * codebase imports pdf-parse or pdfjs-dist anymore.
   */
  experimental: {
    serverActions: {
      // Raised from the 1MB default (confirmed 2026-08-12) — real document
      // upload for AI & Governance / Tender Readiness / Data Protection
      // Compliance intake needs to accept real PDF/DOCX policy documents,
      // which routinely exceed 1MB. Must stay in sync with
      // MAX_DOCUMENT_SIZE_BYTES in src/lib/documents/constants.ts, which
      // enforces the same real ceiling at the application level so the
      // client gets an honest, specific error instead of a generic
      // request-too-large failure.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
