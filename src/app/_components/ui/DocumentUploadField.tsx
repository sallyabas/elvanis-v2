"use client";

import { useRef, useState } from "react";
import { extractDocumentTextAction } from "@/lib/documents/actions";
import { MAX_DOCUMENT_SIZE_BYTES } from "@/lib/documents/constants";
import { Alert } from "./Alert";

/**
 * Shared real-document-upload widget (confirmed 2026-08-12) — one
 * component behind all three intake surfaces that now accept a real
 * PDF/DOCX instead of only a typed description (AI & Governance's
 * document-review mode, Tender Readiness's existing-documentation field,
 * Data Protection Compliance's new shared policy-document field). Calls
 * the extraction Server Action, then hands the extracted text back to the
 * parent via onExtracted — the parent decides what to do with it (usually
 * populate the same textarea a client could otherwise type into), so this
 * component owns only the upload/extract/error UI, not the resulting
 * evidence field itself.
 */
export function DocumentUploadField({
  label,
  hint,
  onExtracted,
  disabled,
}: {
  label: string;
  hint?: string;
  onExtracted: (text: string) => void;
  disabled?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Real gap found and closed before shipping (confirmed 2026-08-12,
    // direct founder question about validation coverage): the server-side
    // size check in extract-text.ts uses the exact same 10MB ceiling as
    // next.config.ts's serverActions.bodySizeLimit, which means a
    // genuinely oversized file would be rejected by Next's own generic
    // body-size-limit handling BEFORE our code ever runs — the friendly
    // "This file is too large" message could never actually fire for the
    // case it exists to explain. A client-side pre-check here is the real
    // fix, not a redundant nicety: it catches the case immediately, with
    // no wasted upload, using the exact same ceiling so it can never
    // disagree with the server-side check.
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      setStatus("error");
      setFileName(null);
      setError(`This file is too large (${(file.size / 1024 / 1024).toFixed(1)}MB) — the limit is 10MB.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setStatus("uploading");
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    // Real gap found 2026-08-15, same class as every other uncaught-RPC-
    // failure bug fixed this same day (see the submit handlers in
    // TenderReadinessIntakeForm.tsx etc.) — this specific call site was
    // missed in that pass, since it's a separate action (upload) from the
    // ones fixed then (final submit). An uncaught rejection here (a real
    // network failure, or a genuine platform-level failure inside the
    // action itself) left the widget stuck on "Reading document…" forever
    // with no visible error, exactly the "stuck loading" bug already fixed
    // elsewhere — closed the same way, with a real try/catch around the
    // await.
    try {
      const result = await extractDocumentTextAction(formData);
      if (result.success) {
        setStatus("success");
        setFileName(file.name);
        onExtracted(result.text);
      } else {
        setStatus("error");
        setFileName(null);
        setError(result.error);
      }
    } catch {
      setStatus("error");
      setFileName(null);
      setError("Something went wrong reaching the server — please try again.");
    }
    // Allow re-selecting the exact same file (e.g. after fixing it and
    // re-uploading) — the browser otherwise skips the change event for an
    // unchanged file input value.
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">{label}</label>
      {hint && <p className="text-xs text-neutral-500 dark:text-neutral-400">{hint}</p>}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx"
        disabled={disabled || status === "uploading"}
        onChange={handleFileChange}
        className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-md file:border file:border-neutral-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-neutral-700 hover:file:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-neutral-300 dark:file:border-neutral-700 dark:file:bg-neutral-900 dark:file:text-neutral-300 dark:hover:file:bg-neutral-800"
      />
      {status === "uploading" && <p className="text-xs text-neutral-500 dark:text-neutral-400">Reading document…</p>}
      {status === "success" && fileName && (
        <Alert variant="success" className="text-xs">
          Extracted text from &ldquo;{fileName}&rdquo; — review it below and edit if needed before submitting.
        </Alert>
      )}
      {status === "error" && error && (
        <Alert variant="error" className="text-xs">
          {error}
        </Alert>
      )}
    </div>
  );
}
