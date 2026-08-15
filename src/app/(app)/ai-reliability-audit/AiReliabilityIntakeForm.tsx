"use client";

import { useState } from "react";
import { SELF_TEST_PROMPTS } from "@/lib/modules/ai-reliability-audit/self-test-prompts";
import type { AgentAutomationEvidence, AiReliabilityDraftInput, AiReliabilitySystemType } from "@/lib/modules/ai-reliability-audit/types";
import { submitAiReliabilityAudit } from "./actions";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Select } from "@/app/_components/ui/Select";
import { Card } from "@/app/_components/ui/Card";
import { Button } from "@/app/_components/ui/Button";
import { Alert } from "@/app/_components/ui/Alert";
import { ModuleSubmittedNotice } from "@/app/_components/ModuleSubmittedNotice";

export function AiReliabilityIntakeForm({ companyId, reviewPeriodHours }: { companyId: string; reviewPeriodHours: number }) {
  const [systemType, setSystemType] = useState<AiReliabilitySystemType | null>(null);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [evidence, setEvidence] = useState<AgentAutomationEvidence>({
    hasTraceLogs: false,
    traceLogsSummary: "",
    operatingCredentialsDescription: "",
    actionsAttributable: null,
    hasHumanEscalation: null,
    escalationDescription: "",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!systemType) return;
    setStatus("submitting");
    setError(null);

    const input: AiReliabilityDraftInput =
      systemType === "conversational"
        ? {
            companyId,
            systemType: "conversational",
            conversationalTranscripts: SELF_TEST_PROMPTS.map((p, i) => ({
              category: p.category,
              promptUsed: p.prompt,
              aiResponse: (responses[i] ?? "").trim(),
            })).filter((t) => t.aiResponse.length > 0),
          }
        : {
            companyId,
            systemType: "agent_automation",
            agentAutomationEvidence: {
              hasTraceLogs: evidence.hasTraceLogs,
              traceLogsSummary: evidence.traceLogsSummary?.trim() || null,
              operatingCredentialsDescription: evidence.operatingCredentialsDescription?.trim() || null,
              actionsAttributable: evidence.actionsAttributable,
              hasHumanEscalation: evidence.hasHumanEscalation,
              escalationDescription: evidence.escalationDescription?.trim() || null,
            },
          };

    // Real production bug found and fixed 2026-08-15 — see
    // TenderReadinessIntakeForm.tsx's doSubmit() for the full root-cause
    // writeup (a genuine RPC-level failure, most likely a serverless
    // function timeout during a slow/rate-limited Groq call, was never
    // caught here, leaving the loading overlay spinning forever).
    try {
      const result = await submitAiReliabilityAudit(input);
      if (result.success) {
        setStatus("done");
      } else {
        setError(result.error ?? "Something went wrong.");
        setStatus("error");
      }
    } catch {
      setError("Something went wrong reaching the server — please try again.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-semibold">AI Reliability Audit</h1>
        <ModuleSubmittedNotice reviewPeriodHours={reviewPeriodHours} />
      </div>
    );
  }

  /**
   * Real "stuck on loading" bug found in live testing of Tender Readiness
   * (confirmed 2026-08-15) and confirmed to apply here too — the same
   * architecture: submitAiReliabilityAudit() runs a real, synchronous Groq
   * call in this same request, with zero loading feedback beyond a
   * button-text change to "Submitting…", the same class of gap already
   * found and fixed for Evidence Intake. Fixed the same way: a real
   * full-screen overlay with expectation-setting copy. No document-upload
   * field exists in this module — the other two reported issues (ambiguous
   * "optional" upload label, missing confirm-if-blank gate) don't apply.
   */
  const loadingOverlay = status === "submitting" && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 text-center shadow-lg dark:bg-neutral-900">
        <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-accent dark:border-neutral-700" aria-hidden="true" />
        <h3 className="mb-1 text-base font-semibold text-neutral-900 dark:text-neutral-50">Analyzing your submission…</h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          We&apos;re running the adversarial-testing analysis against your evidence. This usually takes under a minute — please don&apos;t close this tab.
        </p>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {loadingOverlay}
      <h1 className="mb-1 text-2xl font-semibold">AI Reliability Audit</h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
        Evidence-based adversarial testing against documented real-world AI failure patterns — no live access to your
        systems required.
      </p>

      {!systemType ? (
        <section className="space-y-3">
          <h2 className="font-medium text-neutral-900 dark:text-neutral-50">
            Does your AI have a conversational interface, or does it run autonomously in the background?
          </h2>
          <button
            onClick={() => setSystemType("conversational")}
            className="block w-full rounded-md border border-neutral-300 bg-white p-4 text-left shadow-sm transition-colors hover:border-accent hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            <div className="font-medium text-neutral-900 dark:text-neutral-50">Conversational (chatbot)</div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Customers or users interact with it directly through chat.</div>
          </button>
          <button
            onClick={() => setSystemType("agent_automation")}
            className="block w-full rounded-md border border-neutral-300 bg-white p-4 text-left shadow-sm transition-colors hover:border-accent hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-neutral-800"
          >
            <div className="font-medium text-neutral-900 dark:text-neutral-50">Agent / automation</div>
            <div className="text-sm text-neutral-500 dark:text-neutral-400">Runs in the background with no direct user-facing chat interface.</div>
          </button>
        </section>
      ) : systemType === "conversational" ? (
        <section className="space-y-6">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Run each prompt below against your own live chatbot and paste back the real response. Leave any you
            didn&apos;t run blank.
          </p>
          {SELF_TEST_PROMPTS.map((p, i) => (
            <Card key={i}>
              <div className="mb-2 space-y-1">
                <div className="text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                  {p.category.replace(/_/g, " ")}
                </div>
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-50">{p.prompt}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">{p.whatWereLookingFor}</div>
              </div>
              <Textarea
                rows={3}
                placeholder="Paste the AI's real response here…"
                value={responses[i] ?? ""}
                onChange={(e) => setResponses((prev) => ({ ...prev, [i]: e.target.value }))}
              />
            </Card>
          ))}
          {status === "error" && error && <Alert variant="error">{error}</Alert>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setSystemType(null)}>
              Back
            </Button>
            <Button disabled={status === "submitting"} onClick={handleSubmit}>
              {status === "submitting" ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <Select
            label="Do you have trace logs or execution history for this agent?"
            value={evidence.hasTraceLogs ? "yes" : "no"}
            onChange={(e) => setEvidence((prev) => ({ ...prev, hasTraceLogs: e.target.value === "yes" }))}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </Select>
          {evidence.hasTraceLogs && (
            <Textarea
              label="Briefly summarize what the logs show"
              rows={3}
              value={evidence.traceLogsSummary ?? ""}
              onChange={(e) => setEvidence((prev) => ({ ...prev, traceLogsSummary: e.target.value }))}
            />
          )}
          <Textarea
            label="What credentials/permissions does it operate under?"
            rows={2}
            value={evidence.operatingCredentialsDescription ?? ""}
            onChange={(e) => setEvidence((prev) => ({ ...prev, operatingCredentialsDescription: e.target.value }))}
          />
          <Select
            label="Are its actions attributable to it specifically (not a shared account)?"
            value={evidence.actionsAttributable === null ? "" : evidence.actionsAttributable ? "yes" : "no"}
            onChange={(e) => setEvidence((prev) => ({ ...prev, actionsAttributable: e.target.value === "" ? null : e.target.value === "yes" }))}
          >
            <option value="">Unknown</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </Select>
          <Select
            label="Does a human review/escalation step exist for its consequential actions?"
            value={evidence.hasHumanEscalation === null ? "" : evidence.hasHumanEscalation ? "yes" : "no"}
            onChange={(e) => setEvidence((prev) => ({ ...prev, hasHumanEscalation: e.target.value === "" ? null : e.target.value === "yes" }))}
          >
            <option value="">Unknown</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </Select>
          {evidence.hasHumanEscalation && (
            <Textarea
              label="Briefly describe the escalation process"
              rows={2}
              value={evidence.escalationDescription ?? ""}
              onChange={(e) => setEvidence((prev) => ({ ...prev, escalationDescription: e.target.value }))}
            />
          )}
          {status === "error" && error && <Alert variant="error">{error}</Alert>}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => setSystemType(null)}>
              Back
            </Button>
            <Button disabled={status === "submitting"} onClick={handleSubmit}>
              {status === "submitting" ? "Submitting…" : "Submit for review"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
