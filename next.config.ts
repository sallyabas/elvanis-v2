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
