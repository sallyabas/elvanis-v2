"use client";

import { useState } from "react";
import type { CompanyJurisdictionInput } from "@/lib/modules/data-protection-compliance/jurisdiction";
import { submitDataProtectionComplianceAudit } from "./actions";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";
import { DocumentUploadField } from "@/app/_components/ui/DocumentUploadField";

const CATEGORY_FIELDS: { key: "consentFlow" | "dataSubjectRights" | "retentionPolicy" | "breachResponse" | "crossBorderTransfer"; label: string; placeholder: string }[] = [
  {
    key: "consentFlow",
    label: "Consent-flow review",
    placeholder: "How do you capture, record, and let people withdraw consent (e.g. cookie banner, signup checkbox, marketing opt-in)?",
  },
  {
    key: "dataSubjectRights",
    label: "Data-subject-rights readiness (access / correct / delete / port)",
    placeholder: "How would you handle someone asking to see, correct, delete, or export their data? Any process today?",
  },
  {
    key: "retentionPolicy",
    label: "Retention policy review",
    placeholder: "How long is personal data kept, and is there a defined deletion process once it's no longer needed?",
  },
  {
    key: "breachResponse",
    label: "Breach-response readiness",
    placeholder: "If a data breach happened today, what's the process for detecting it, escalating internally, and notifying regulators/individuals?",
  },
  {
    key: "crossBorderTransfer",
    label: "Cross-border transfer check",
    placeholder: "Does personal data leave the UK/EU (e.g. a US-hosted tool)? What safeguards, if any, are in place (SCCs, adequacy, etc.)?",
  },
];

/**
 * Three real bugs found in live testing of Tender Readiness (confirmed
 * 2026-08-15), checked and fixed here too where they apply — see that
 * module's own docblock for the full root-cause writeup.
 *
 * 1. "Stuck on loading" — same architecture (a real, synchronous Groq
 *    call with zero loading feedback beyond a button-text change), same
 *    fix (a real full-screen overlay).
 * 2 & 3. This module's document field is genuinely different from Tender
 *    Readiness's: ONE shared upload (deliberately, per explicit founder
 *    direction — a real privacy policy naturally covers several of the
 *    five categories at once), with no equivalent free-text-only path —
 *    a client can only get text into `existingDocumentationText` by
 *    uploading something first. So the upload label already clearly says
 *    "Upload" (item 2 was already satisfied here); what still applied was
 *    "optional" reading as "uploading is optional" rather than "you may
 *    not have this," and the missing confirm-if-blank gate. Fixed by
 *    removing "optional" and adding the same confirm step, scoped to this
 *    one shared document field specifically — the five category fields
 *    already carry their own "blank is meaningful too" framing above
 *    them, so a second confirm gate per category would be redundant, not
 *    requested, and worse UX for a 5-field form.
 */
export function DataProtectionIntakeForm({
  companyId,
  jurisdictionInput,
}: {
  companyId: string;
  jurisdictionInput: CompanyJurisdictionInput;
}) {
  const [values, setValues] = useState<Record<string, string>>({
    consentFlow: "",
    dataSubjectRights: "",
    retentionPolicy: "",
    breachResponse: "",
    crossBorderTransfer: "",
  });
  /**
   * Real document upload (confirmed 2026-08-12) — deliberately ONE shared
   * field, not five, per explicit founder direction: a real privacy
   * policy naturally covers several of the five categories at once, so
   * splitting one document into five separate uploads would be a worse
   * client experience with no real benefit. The module's own buildPrompt()
   * decides, per category, whether this document actually addresses it —
   * see index.ts's reconcileBlankCategoryFindings() for how that's kept
   * deterministic rather than trusted from a prompt instruction alone.
   */
  const [existingDocumentationText, setExistingDocumentationText] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "confirming" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const anyFilled = Object.values(values).some((v) => v.trim().length > 0) || Boolean(existingDocumentationText?.trim());

  async function doSubmit() {
    setStatus("submitting");
    const result = await submitDataProtectionComplianceAudit({
      companyId,
      company: jurisdictionInput,
      evidence: {
        consentFlow: values.consentFlow.trim() || null,
        dataSubjectRights: values.dataSubjectRights.trim() || null,
        retentionPolicy: values.retentionPolicy.trim() || null,
        breachResponse: values.breachResponse.trim() || null,
        crossBorderTransfer: values.crossBorderTransfer.trim() || null,
      },
      existingDocumentationText: existingDocumentationText?.trim() || null,
    });
    if (result.success) {
      setRequestId(result.requestId ?? null);
      setStatus("done");
    } else {
      setError(result.error ?? "Something went wrong.");
      setStatus("error");
    }
  }

  function handleSubmitClick() {
    if (!existingDocumentationText || existingDocumentationText.trim().length === 0) {
      setStatus("confirming");
      return;
    }
    doSubmit();
  }

  if (status === "done") {
    return (
      <p className="rounded-md border border-green-300 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
        Submitted for review. Request ID: {requestId}
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Leave any area blank if nothing is in place yet — that&apos;s meaningful evidence too, not an incomplete submission.
      </p>
      {/* Real document upload (confirmed 2026-08-12) — one shared field
          covering all five categories below, not five separate uploads.
          Additive, not a replacement: the five category fields still work
          exactly as before with nothing uploaded here. */}
      <DocumentUploadField
        label="Upload an existing privacy policy or documentation"
        hint="PDF or DOCX — a real privacy policy often covers several of the areas below at once. We'll extract the text and use it alongside anything you type below; you don't need to also fill in every matching field by hand. Don't have anything to upload? That's fine — we'll check with you before submitting."
        onExtracted={(text) => setExistingDocumentationText(text)}
      />
      {existingDocumentationText !== null && (
        // Real gap found and fixed during live verification (confirmed
        // 2026-08-12): DocumentUploadField's own success message promises
        // "review it below and edit if needed before submitting" — true
        // for AI & Governance and Tender Readiness, which both feed the
        // extraction straight into an existing visible textarea, but this
        // module's shared document doesn't map onto any single one of the
        // five category fields below, so the extracted text was captured
        // in state and silently never shown anywhere. Fixed by giving it
        // its own visible, editable textarea, distinct from the five
        // category fields, so the promise the upload widget itself makes
        // is actually true here too.
        <Textarea
          label="Extracted document text (edit if needed)"
          rows={6}
          value={existingDocumentationText}
          onChange={(e) => setExistingDocumentationText(e.target.value)}
        />
      )}
      {CATEGORY_FIELDS.map((field) => (
        <Textarea
          key={field.key}
          label={field.label}
          rows={3}
          placeholder={field.placeholder}
          value={values[field.key]}
          onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
        />
      ))}
      {status === "error" && error && <Alert variant="error">{error}</Alert>}

      {status === "confirming" && (
        <Alert variant="info">
          <p className="mb-2 font-medium">Confirming: you don&apos;t have an existing privacy policy or documentation to share?</p>
          <p className="mb-3 text-sm">
            That&apos;s a real, useful finding on its own — we&apos;ll flag it as a gap to close, not treat it as an error.
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={doSubmit}>
              Yes, continue without a document
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStatus("idle")}>
              Go back and add it
            </Button>
          </div>
        </Alert>
      )}

      {status !== "confirming" && (
        <Button disabled={status === "submitting" || !anyFilled} onClick={handleSubmitClick}>
          {status === "submitting" ? "Submitting…" : "Submit for review"}
        </Button>
      )}

      {status === "submitting" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-lg dark:bg-neutral-900">
            <div
              className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-accent dark:border-neutral-700"
              aria-hidden="true"
            />
            <h3 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-50">Analyzing your submission…</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              We&apos;re assessing your data-protection posture against the applicable regulations. This usually takes under a minute — please don&apos;t
              close this tab.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
