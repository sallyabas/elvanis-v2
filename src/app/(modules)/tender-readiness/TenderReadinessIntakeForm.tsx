"use client";

import { useState } from "react";
import type { CompanyJurisdictionInput } from "@/lib/modules/tender-readiness/jurisdiction";
import { submitTenderReadinessAudit } from "./actions";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";
import { DocumentUploadField } from "@/app/_components/ui/DocumentUploadField";

export function TenderReadinessIntakeForm({
  companyId,
  jurisdictionInput,
}: {
  companyId: string;
  jurisdictionInput: CompanyJurisdictionInput;
}) {
  const [aiUseCaseInventory, setAiUseCaseInventory] = useState("");
  const [existingDocumentation, setExistingDocumentation] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  async function handleSubmit() {
    setStatus("submitting");
    const result = await submitTenderReadinessAudit({
      companyId,
      company: jurisdictionInput,
      aiUseCaseInventory: aiUseCaseInventory.trim(),
      existingDocumentation: existingDocumentation.trim() || null,
    });
    if (result.success) {
      setRequestId(result.requestId ?? null);
      setStatus("done");
    } else {
      setError(result.error ?? "Something went wrong.");
      setStatus("error");
    }
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
        label="Upload existing compliance documentation (optional)"
        hint="PDF or DOCX — e.g. a risk assessment, AI use inventory, or procurement-readiness material already prepared. We'll extract the text; you can review and edit it below before submitting."
        onExtracted={(text) => setExistingDocumentation(text)}
      />
      <Textarea
        label="Existing compliance documentation, if any (optional)"
        rows={3}
        placeholder="Any risk assessments, AI use inventories, or procurement-readiness material already prepared…"
        value={existingDocumentation}
        onChange={(e) => setExistingDocumentation(e.target.value)}
      />
      {status === "error" && error && <Alert variant="error">{error}</Alert>}
      <Button disabled={status === "submitting" || aiUseCaseInventory.trim().length === 0} onClick={handleSubmit}>
        {status === "submitting" ? "Submitting…" : "Submit for review"}
      </Button>
    </section>
  );
}
