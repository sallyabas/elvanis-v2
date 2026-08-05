"use client";

import { useState } from "react";
import type { CompanyJurisdictionInput } from "@/lib/modules/tender-readiness/jurisdiction";
import { submitTenderReadinessAudit } from "./actions";

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
      <p className="rounded border border-green-300 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
        Submitted for review. Request ID: {requestId}
      </p>
    );
  }

  return (
    <section className="space-y-4">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Describe the AI systems/features your company uses or builds</span>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={4}
          placeholder="e.g. a customer-facing chatbot for support, an internal automation that auto-approves refunds under $50…"
          value={aiUseCaseInventory}
          onChange={(e) => setAiUseCaseInventory(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-sm font-medium">Existing compliance documentation, if any (optional)</span>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={3}
          placeholder="Any risk assessments, AI use inventories, or procurement-readiness material already prepared…"
          value={existingDocumentation}
          onChange={(e) => setExistingDocumentation(e.target.value)}
        />
      </label>
      {status === "error" && error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={status === "submitting" || aiUseCaseInventory.trim().length === 0}
        onClick={handleSubmit}
        className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
      >
        {status === "submitting" ? "Submitting…" : "Submit for review"}
      </button>
    </section>
  );
}
