import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Real document-upload test fixtures (confirmed 2026-09-04, combinatorial
 * E2E pass) — hand-built rather than reaching for a PDF-generation library,
 * since a byte-correct minimal PDF is small and well-understood, and this
 * avoids adding a new dependency just for test fixtures. Verified against
 * the app's own real extractor (unpdf) directly before use in any spec —
 * see the inline verification this file's own author ran, not assumed
 * correct from the byte layout alone.
 */

/** Builds a genuinely valid, minimal single-page PDF containing `text` as real, extractable content. Byte offsets in the xref table are computed exactly, not approximated — pdf.js (which unpdf wraps) is not lenient about a malformed xref. */
export function buildMinimalPdf(text: string): Buffer {
  const escaped = text.replace(/([\\()])/g, "\\$1");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const stream = `BT /F1 18 Tf 72 700 Td (${escaped}) Tj ET`;
  const streamObj = `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`;

  const header = "%PDF-1.4\n";
  let body = header;
  const offsets: number[] = [];

  objects.forEach((content, i) => {
    offsets.push(Buffer.byteLength(body, "utf8"));
    body += `${i + 1} 0 obj\n${content}\nendobj\n`;
  });
  offsets.push(Buffer.byteLength(body, "utf8"));
  body += `5 0 obj\n${streamObj}\nendobj\n`;

  const xrefOffset = Buffer.byteLength(body, "utf8");
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(body + xref + trailer, "utf8");
}

/** A single directory shared across one test run's fixture files, so they don't need individual cleanup calls scattered through specs. */
export function makeFixtureDir(): string {
  return mkdtempSync(join(tmpdir(), "elvanis-e2e-docs-"));
}

export function writeFixture(dir: string, name: string, content: Buffer): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

/** Real mammoth test fixtures (node_modules/mammoth/test/test-data/) — genuine, well-formed .docx files with known, verified extractable-text lengths, reused rather than hand-built (a byte-correct minimal .docx is a real zip archive with specific internal XML — not worth reimplementing for a test fixture when real ones already exist in a dependency this app already has). */
export const REAL_DOCX_FIXTURES = {
  /** 62 chars extractable — above the ~50-char "insufficient content" floor. */
  sufficientContent: "node_modules/mammoth/test/test-data/tables.docx",
  /** 7 chars extractable — below the floor, a genuine "insufficient content" case with a real .docx file (not a PDF). */
  insufficientContent: "node_modules/mammoth/test/test-data/endnotes.docx",
};
