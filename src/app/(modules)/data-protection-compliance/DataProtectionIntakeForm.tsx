"use client";

import { useState } from "react";
import type { CompanyJurisdictionInput } from "@/lib/modules/data-protection-compliance/jurisdiction";
import { submitDataProtectionComplianceAudit } from "./actions";

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
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);

  const anyFilled = Object.values(values).some((v) => v.trim().length > 0);

  async function handleSubmit() {
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
      <p className="text-xs text-neutral-400">
        Leave any area blank if nothing is in place yet — that&apos;s meaningful evidence too, not an incomplete submission.
      </p>
      {CATEGORY_FIELDS.map((field) => (
        <label key={field.key} className="block space-y-1">
          <span className="text-sm font-medium">{field.label}</span>
          <textarea
            className="w-full rounded border px-3 py-2 text-sm"
            rows={3}
            placeholder={field.placeholder}
            value={values[field.key]}
            onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
          />
        </label>
      ))}
      {status === "error" && error && <p className="text-sm text-red-600">{error}</p>}
      <button
        disabled={status === "submitting" || !anyFilled}
        onClick={handleSubmit}
        className="rounded bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-40"
      >
        {status === "submitting" ? "Submitting…" : "Submit for review"}
      </button>
    </section>
  );
}
