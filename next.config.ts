import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Real bug found and fixed live (confirmed 2026-08-12): pdf-parse (via
  // pdfjs-dist) does its Node-side "fake worker" text extraction using a
  // fully-dynamic `import(this.workerSrc)` call, marked with pdfjs-dist's
  // own `/*webpackIgnore*/`/`/*@vite-ignore*/` comments telling webpack and
  // vite not to try to statically bundle it — there is no Turbopack
  // equivalent of that hint, so Turbopack still intercepts the call and
  // mis-resolves it to a `.next/dev/server/chunks/ssr/pdf.worker.mjs` path
  // that was never actually written to disk, regardless of what
  // `GlobalWorkerOptions.workerSrc` is set to at runtime — confirmed by
  // reading pdfjs-dist's own source directly (PDFWorker#_setupFakeWorkerGlobal
  // in node_modules/pdfjs-dist/legacy/build/pdf.mjs) after an initial
  // attempt to fix this by pointing `setWorker()` at a real resolved disk
  // path had zero effect on the actual error. `serverExternalPackages`
  // keeps this dependency out of the Turbopack/webpack server bundle
  // entirely, so Node's own native module resolution loads and executes it
  // untouched — the same environment it was directly verified to work
  // correctly in during standalone testing.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
  /**
   * Real bug found in production 2026-08-15, a different failure mode from
   * the Turbopack dev-mode bug documented above — that one was fixed and
   * confirmed via local `next dev`/`npm run build`, but neither of those
   * exercises Vercel's own deployment-time file tracing, which determines
   * which files actually ship inside the deployed serverless function.
   * pdf-parse loads its worker via a fully-dynamic `import(this.workerSrc)`
   * call from WITHIN its own code (not a static import this repo's code
   * controls) — exactly the kind of import Vercel's static tracer can miss,
   * since the path isn't known until runtime. If that worker file isn't
   * included in the deployed function's filesystem, the extraction throws
   * at runtime in production even though it works locally, surfacing as a
   * raw 500 to the client. `outputFileTracingIncludes` is the real,
   * documented mechanism for forcing files a tracer missed into a specific
   * route's deployed bundle — applied to the three real routes that use
   * document upload (Tender Readiness, Data Protection Compliance, and
   * Evidence Intake, which carries AI & Governance's document-review mode).
   * Disclosed honestly: this is the strongest available hypothesis for the
   * root cause, not a confirmed fix — it can't be verified from local dev,
   * only from an actual Vercel deployment. Paired with a real defensive
   * try/catch in extractDocumentTextAction() (see that file) so that even
   * if this doesn't fully resolve it, the client gets an honest error
   * instead of a raw crash either way.
   */
  outputFileTracingIncludes: {
    "/tender-readiness": ["./node_modules/pdf-parse/**/*.mjs", "./node_modules/pdfjs-dist/**/*.mjs"],
    "/data-protection-compliance": ["./node_modules/pdf-parse/**/*.mjs", "./node_modules/pdfjs-dist/**/*.mjs"],
    "/evidence-intake": ["./node_modules/pdf-parse/**/*.mjs", "./node_modules/pdfjs-dist/**/*.mjs"],
  },
  experimental: {
    serverActions: {
      // Raised from the 1MB default (confirmed 2026-08-12) — real document
      // upload for AI & Governance / Tender Readiness / Data Protection
      // Compliance intake needs to accept real PDF/DOCX policy documents,
      // which routinely exceed 1MB. Must stay in sync with
      // MAX_DOCUMENT_SIZE_BYTES in src/lib/documents/extract-text.ts,
      // which enforces the same real ceiling at the application level so
      // the client gets an honest, specific error instead of a generic
      // request-too-large failure.
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
