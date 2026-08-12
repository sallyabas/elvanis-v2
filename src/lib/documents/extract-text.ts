import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

/**
 * Real bug found and root-caused during live verification (confirmed
 * 2026-08-12) — pdf-parse v2 is built on pdfjs-dist, which does its
 * Node-side text extraction via a "fake worker" (in-process, no real
 * worker thread) loaded with a fully-dynamic `import(this.workerSrc)` call
 * inside pdfjs-dist itself (PDFWorker#_setupFakeWorkerGlobal in
 * node_modules/pdfjs-dist/legacy/build/pdf.mjs). That call is marked with
 * pdfjs-dist's own `/*webpackIgnore*\/`/`/*@vite-ignore*\/` comments
 * telling webpack and vite not to try to statically bundle it — but there
 * is no Turbopack equivalent of that hint, so Turbopack still intercepts
 * the dynamic import and mis-resolves it to a
 * `.next/dev/server/chunks/ssr/pdf.worker.mjs` path that's never actually
 * written to disk, regardless of what `GlobalWorkerOptions.workerSrc` is
 * set to at runtime. Confirmed by reading pdfjs-dist's source directly,
 * not guessed — an initial attempt to fix this by pointing
 * `PDFParse.setWorker()` at a real resolved disk path (verified correct in
 * isolation) had zero effect on the actual live error, which is what led
 * to reading the library's own source rather than continuing to guess at
 * path values.
 *
 * Fixed at the bundler-config level instead, in next.config.ts's
 * `serverExternalPackages: ["pdf-parse", "pdfjs-dist"]` — this keeps the
 * dependency out of the Turbopack/webpack server bundle entirely, so
 * Node's own native ESM resolution loads and executes it untouched. Once
 * unbundled, pdfjs-dist's own default relative worker path
 * (`./pdf.worker.mjs`, resolved against its own module location) just
 * works, since that file genuinely sits right next to it on disk
 * (confirmed: node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs exists)
 * — no custom worker-path resolution needed here at all.
 */

/**
 * Real document upload + text extraction (confirmed 2026-08-12, direct
 * founder request) — closes a real gap found while investigating a
 * different question: "does Tender Readiness / Data Protection Compliance
 * support real document upload for the AI to read?" No module did, and
 * neither did AI & Governance's own "document-review mode," which turned
 * out to be a free-text description textarea, not real document ingestion
 * — confirmed by reading the code directly, not assumed. This module is
 * the shared extraction primitive all three surfaces now use.
 *
 * Deliberately the smaller problem, not the deferred native-export
 * pipeline (CSV/PDF financial exports with per-source column-mapping,
 * still confirmed deferred — see the Evidence Intake scope decision in
 * CLAUDE.md). No column-mapping here: extract raw text, nothing else.
 *
 * Deliberately extract-only, no persistent storage of the raw file
 * (confirmed 2026-08-12, explicit founder decision) — avoids standing up
 * Supabase Storage + RLS policies (net-new infrastructure, unused
 * anywhere else in this app) for a feature whose only job is getting real
 * text in front of the LLM. Real tradeoff, accepted explicitly: the
 * original file can't be re-opened or re-extracted later if the parser
 * improves.
 */

export { ACCEPTED_DOCUMENT_EXTENSIONS, MAX_DOCUMENT_SIZE_BYTES } from "./constants";
import { MAX_DOCUMENT_SIZE_BYTES } from "./constants";

/** Below this length, treat extraction as failed rather than send near-nothing to an LLM as if it were real evidence — same "missing evidence is itself a finding" discipline used everywhere else in this codebase, applied here at the point of ingestion instead of at prompt-build time. */
const MIN_MEANINGFUL_TEXT_LENGTH = 50;

export type ExtractTextResult = { success: true; text: string } | { success: false; error: string };

/**
 * Extracts raw text from a real uploaded PDF or DOCX file. Never throws —
 * every real failure mode observed during testing (corrupted file,
 * password-protected PDF, wrong format, scanned/image-only PDF with no
 * text layer) is caught and returned as an honest, specific error message
 * instead of a raw exception or silently-empty text.
 */
export async function extractTextFromDocument(file: File): Promise<ExtractTextResult> {
  const name = file.name.toLowerCase();
  const isPdf = name.endsWith(".pdf");
  const isDocx = name.endsWith(".docx");

  if (!isPdf && !isDocx) {
    // Deliberately explicit about .doc (old binary Word format) rather
    // than letting it silently hit the docx path and mis-parse — .doc and
    // .docx are genuinely different file formats, not just an extension.
    if (name.endsWith(".doc")) {
      return { success: false, error: "This is a .doc file (older Word format) — please save it as .docx or export it as a PDF instead." };
    }
    return { success: false, error: "Only PDF and DOCX files are supported. Please upload a .pdf or .docx file." };
  }

  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    return { success: false, error: `This file is too large (${(file.size / 1024 / 1024).toFixed(1)}MB) — the limit is 10MB.` };
  }
  if (file.size === 0) {
    return { success: false, error: "This file appears to be empty." };
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let rawText: string;
  try {
    if (isPdf) {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      rawText = result.text;
    } else {
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value;
    }
  } catch (err) {
    // Confirmed live against real corrupted/invalid files during
    // development — both pdf-parse and mammoth throw a clear message on
    // malformed input (e.g. "Invalid PDF structure.", "Can't find end of
    // central directory : is this a zip file?") rather than returning
    // garbage, so surfacing err.message directly is honest here, not a
    // generic catch-all.
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: `Couldn't read this file (${message}). It may be corrupted, password-protected, or not a valid ${isPdf ? "PDF" : "DOCX"}.` };
  }

  const trimmed = rawText.trim();
  if (trimmed.length < MIN_MEANINGFUL_TEXT_LENGTH) {
    // Confirmed live: a scanned/image-only PDF run through pdf-parse
    // returns near-empty text (observed: a 16-character page-number
    // artifact, not real content) rather than throwing — this is the real
    // failure mode that discipline exists to catch, distinct from a
    // genuinely short document (which would be unusual for a real policy
    // but not impossible; the threshold favors catching the common real
    // failure over accommodating a rare true-short document, and the
    // client can always fall back to typing).
    return {
      success: false,
      error: "We couldn't find readable text in this file — it may be a scanned image with no text layer. Try a different file, or type the relevant details directly.",
    };
  }

  return { success: true, text: trimmed };
}
