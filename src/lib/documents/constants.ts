/**
 * Shared, import-safe-from-the-client constants for document upload
 * (confirmed 2026-08-12) — deliberately split out of extract-text.ts,
 * which imports unpdf/mammoth at module scope (real Node-only
 * dependencies that must never end up in a client bundle). Both the
 * server-side extractor and the client-side upload widget import these
 * same values, so the two can't drift.
 */

export const ACCEPTED_DOCUMENT_EXTENSIONS = [".pdf", ".docx"] as const;

/** Real ceiling, not a Next.js default left unexamined — see next.config.ts's matching serverActions.bodySizeLimit, which this must stay under. */
export const MAX_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
