"use client";

import { useState } from "react";
import type { CompanyJurisdictionInput } from "@/lib/modules/tender-readiness/jurisdiction";
import { submitTenderReadinessAudit } from "./actions";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Select } from "@/app/_components/ui/Select";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";
import { DocumentUploadField } from "@/app/_components/ui/DocumentUploadField";
import { ModuleSubmittedNotice } from "@/app/_components/ModuleSubmittedNotice";
import { ModuleStartConfirm } from "@/app/_components/ModuleStartConfirm";
import { ContactUsForm } from "@/app/_components/ContactUsForm";
import { MODULE_META } from "@/lib/modules/module-meta";

/**
 * Three real bugs found in live testing, fixed 2026-08-15:
 *
 * 1. "Stuck on loading" — root-caused by reproducing live, not guessed:
 *    `submitTenderReadinessAudit()` runs a real, synchronous Groq call in
 *    this same request (confirmed via server logs: 2.5-3.3s under healthy
 *    conditions, but this codebase has extensively documented real Groq
 *    rate-limit/slowness events elsewhere that can stretch this to tens of
 *    seconds). The completion state itself was always correct — the actual
 *    gap was zero loading feedback beyond a button-text change to
 *    "Submitting…", the exact same class of bug already found and fixed
 *    for Evidence Intake ("no prior feedback beyond a disabled button —
 *    easy to miss entirely, reading as a frozen page"). Fixed the same
 *    way: a real full-screen overlay with expectation-setting copy.
 * 2 & 3. The document field's labels said "optional" in a way that reads
 *    as "uploading is optional" rather than the real meaning ("you may
 *    not have this, and that's fine") and didn't clearly connect the
 *    textarea to the upload above it. Both labels reworded, "optional"
 *    removed, and a real confirm-before-submit step added when nothing
 *    was provided — same "missing evidence is itself a finding" principle
 *    already used in Financial — so a blank field never silently passes
 *    through unconfirmed.
 */
export function TenderReadinessIntakeForm({
  companyId,
  jurisdictionInput,
  reviewPeriodHours,
}: {
  companyId: string;
  jurisdictionInput: CompanyJurisdictionInput;
  reviewPeriodHours: number;
}) {
  const [aiUseCaseInventory, setAiUseCaseInventory] = useState("");
  const [existingDocumentation, setExistingDocumentation] = useState("");
  // EU AI Act Article 4 AI-literacy check (confirmed 2026-08-27,
  // Onboarding Architecture & Path Routing brief, Part 8d) — "" means not
  // yet answered, mapped to null (not false) at submit time so an
  // unanswered question never triggers the guaranteed finding as if it
  // were a real "no."
  const [aiLiteracyTrainingProvided, setAiLiteracyTrainingProvided] = useState<"" | "yes" | "no">("");
  const [status, setStatus] = useState<"start" | "idle" | "confirming" | "submitting" | "done" | "error">("start");
  const [error, setError] = useState<string | null>(null);

  async function doSubmit() {
    setStatus("submitting");
    setError(null);
    try {
      const result = await submitTenderReadinessAudit({
        companyId,
        company: jurisdictionInput,
        aiUseCaseInventory: aiUseCaseInventory.trim(),
        existingDocumentation: existingDocumentation.trim() || null,
        aiLiteracyTrainingProvided: aiLiteracyTrainingProvided === "" ? null : aiLiteracyTrainingProvided === "yes",
      });
      if (result.success) {
        setStatus("done");
      } else {
        setError(result.error ?? "Something went wrong.");
        setStatus("error");
      }
    } catch {
      // Real bug found live in production (confirmed 2026-08-15): a
      // genuine RPC-level failure — most likely the platform's serverless
      // function timeout killing this request mid-flight during a slow or
      // rate-limited Groq call, since submitTenderReadinessAudit()'s own
      // try/catch only covers errors it can construct a real {success:
      // false} response for — rejects the underlying fetch entirely rather
      // than resolving to our own function's return value. Without this
      // catch, that rejection was never caught, status stayed stuck on
      // "submitting" forever, and the loading overlay just fixed for the
      // OTHER "stuck" bug spun indefinitely with no way out. This is a
      // defensive client-side guarantee independent of why the network
      // call failed — see the module page's own maxDuration export for
      // the actual root-cause mitigation.
      setError("Something went wrong reaching the server — please try again.");
      setStatus("error");
    }
  }

  function handleSubmitClick() {
    if (existingDocumentation.trim().length === 0) {
      setStatus("confirming");
      return;
    }
    doSubmit();
  }

  if (status === "start") {
    return (
      <ModuleStartConfirm
        label={MODULE_META.tender_readiness.label}
        description={MODULE_META.tender_readiness.description}
        onContinue={() => setStatus("idle")}
      />
    );
  }

  if (status === "done") {
    return <ModuleSubmittedNotice reviewPeriodHours={reviewPeriodHours} />;
  }

  return (
    <section className="space-y-4">
      <Textarea
        label="Describe the AI systems/features your company uses or builds"
        rows={4}
        placeholder="e.g. a customer-facing chatbot for support, an internal automation that auto-approves refunds under $50…"
        value={aiUseCaseInventory}
        onChange={(e) => setAiUseCaseInventory(e.target.value)}
      />
      {/* Real document upload (confirmed 2026-08-12) — this textarea was
          the only way to describe existing documentation until now,
          description-only, same gap found in AI & Governance's own
          "document-review mode." Upload is additive, not a replacement —
          typing directly still works with nothing to upload. */}
      <DocumentUploadField
        label="Upload existing compliance documentation"
        hint="PDF or DOCX — e.g. a risk assessment, AI use inventory, or procurement-readiness material already prepared. We'll extract the text into the field below, which you can review and edit before submitting. Don't have anything prepared yet? That's fine — leave this and the field below blank, and we'll check with you before submitting."
        onExtracted={(text) => setExistingDocumentation(text)}
      />
      <Textarea
        label="Documentation text — from your upload above, or typed directly"
        rows={3}
        placeholder="Any risk assessments, AI use inventories, or procurement-readiness material already prepared…"
        value={existingDocumentation}
        onChange={(e) => setExistingDocumentation(e.target.value)}
      />
      {/* EU AI Act Article 4 (confirmed 2026-08-27) — a real, structural
          compliance question, independent of the AI use-case description
          above. */}
      <Select
        label="Have you provided structured AI literacy training to staff who use AI tools in their work?"
        hint="Required since February 2025 under EU AI Act Article 4, for any organisation whose staff use AI tools — not only AI product builders."
        value={aiLiteracyTrainingProvided}
        onChange={(e) => setAiLiteracyTrainingProvided(e.target.value as "" | "yes" | "no")}
      >
        <option value="">Not answered</option>
        <option value="yes">Yes</option>
        <option value="no">No</option>
      </Select>
      {status === "error" && error && <Alert variant="error">{error}</Alert>}

      {status === "confirming" && (
        <Alert variant="info">
          <p className="mb-2 font-medium">Confirming: you don&apos;t have existing documentation for this?</p>
          <p className="mb-3 text-sm">
            That&apos;s a real, useful finding on its own — we&apos;ll flag it as a gap to close before your next procurement conversation, not treat it
            as an error.
          </p>
          <div className="flex gap-2">
            <Button type="button" onClick={doSubmit}>
              Yes, continue without documentation
            </Button>
            <Button type="button" variant="secondary" onClick={() => setStatus("idle")}>
              Go back and add it
            </Button>
          </div>
        </Alert>
      )}

      {status !== "confirming" && (
        <Button disabled={status === "submitting" || aiUseCaseInventory.trim().length === 0} onClick={handleSubmitClick}>
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
              We&apos;re classifying your AI use against the applicable jurisdictions. This usually takes a minute or two — please don&apos;t close this
              tab.
            </p>
          </div>
        </div>
      )}

      <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <ContactUsForm companyId={companyId} serviceContext={MODULE_META.tender_readiness.label} />
      </div>
    </section>
  );
}
