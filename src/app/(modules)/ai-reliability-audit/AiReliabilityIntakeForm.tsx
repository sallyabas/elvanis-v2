"use client";

import { useState } from "react";
import { SELF_TEST_PROMPTS } from "@/lib/modules/ai-reliability-audit/self-test-prompts";
import type { AgentAutomationEvidence, AiReliabilityDraftInput, AiReliabilitySystemType } from "@/lib/modules/ai-reliability-audit/types";
import { submitAiReliabilityAudit } from "./actions";

export function AiReliabilityIntakeForm({ companyId }: { companyId: string }) {
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
  const [requestId, setRequestId] = useState<string | null>(null);

  async function handleSubmit() {
    if (!systemType) return;
    setStatus("submitting");

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

    const result = await submitAiReliabilityAudit(input);
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
      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-2 text-2xl font-semibold">AI Reliability Audit</h1>
        <p className="rounded border border-green-300 bg-green-50 p-4 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-300">
          Submitted for review. Request ID: {requestId}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="mb-1 text-2xl font-semibold">AI Reliability Audit</h1>
      <p className="mb-8 text-sm text-neutral-500 dark:text-neutral-400">
        Evidence-based adversarial testing against documented real-world AI failure patterns — no live access to your
        systems required.
      </p>

      {!systemType ? (
        <section className="space-y-3">
          <h2 className="font-medium">Does your AI have a conversational interface, or does it run autonomously in the background?</h2>
          <button
            onClick={() => setSystemType("conversational")}
            className="block w-full rounded border p-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            <div className="font-medium">Conversational (chatbot)</div>
            <div className="text-sm text-neutral-500">Customers or users interact with it directly through chat.</div>
          </button>
          <button
            onClick={() => setSystemType("agent_automation")}
            className="block w-full rounded border p-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900"
          >
            <div className="font-medium">Agent / automation</div>
            <div className="text-sm text-neutral-500">Runs in the background with no direct user-facing chat interface.</div>
          </button>
        </section>
      ) : systemType === "conversational" ? (
        <section className="space-y-6">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Run each prompt below against your own live chatbot and paste back the real response. Leave any you
            didn&apos;t run blank.
          </p>
          {SELF_TEST_PROMPTS.map((p, i) => (
            <div key={i} className="space-y-2 rounded border p-4">
              <div className="text-xs font-medium uppercase text-neutral-400">{p.category.replace(/_/g, " ")}</div>
              <div className="text-sm font-medium">{p.prompt}</div>
              <div className="text-xs text-neutral-500">{p.whatWereLookingFor}</div>
              <textarea
                className="w-full rounded border px-3 py-2 text-sm"
                rows={3}
                placeholder="Paste the AI's real response here…"
                value={responses[i] ?? ""}
                onChange={(e) => setResponses((prev) => ({ ...prev, [i]: e.target.value }))}
              />
            </div>
          ))}
          {status === "error" && error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setSystemType(null)} className="rounded border px-4 py-2 text-sm">
              Back
            </button>
            <button
              disabled={status === "submitting"}
              onClick={handleSubmit}
              className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
              {status === "submitting" ? "Submitting…" : "Submit for review"}
            </button>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Do you have trace logs or execution history for this agent?</span>
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={evidence.hasTraceLogs ? "yes" : "no"}
              onChange={(e) => setEvidence((prev) => ({ ...prev, hasTraceLogs: e.target.value === "yes" }))}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          {evidence.hasTraceLogs && (
            <label className="block space-y-1">
              <span className="text-sm font-medium">Briefly summarize what the logs show</span>
              <textarea
                className="w-full rounded border px-3 py-2 text-sm"
                rows={3}
                value={evidence.traceLogsSummary ?? ""}
                onChange={(e) => setEvidence((prev) => ({ ...prev, traceLogsSummary: e.target.value }))}
              />
            </label>
          )}
          <label className="block space-y-1">
            <span className="text-sm font-medium">What credentials/permissions does it operate under?</span>
            <textarea
              className="w-full rounded border px-3 py-2 text-sm"
              rows={2}
              value={evidence.operatingCredentialsDescription ?? ""}
              onChange={(e) => setEvidence((prev) => ({ ...prev, operatingCredentialsDescription: e.target.value }))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Are its actions attributable to it specifically (not a shared account)?</span>
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={evidence.actionsAttributable === null ? "" : evidence.actionsAttributable ? "yes" : "no"}
              onChange={(e) => setEvidence((prev) => ({ ...prev, actionsAttributable: e.target.value === "" ? null : e.target.value === "yes" }))}
            >
              <option value="">Unknown</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Does a human review/escalation step exist for its consequential actions?</span>
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={evidence.hasHumanEscalation === null ? "" : evidence.hasHumanEscalation ? "yes" : "no"}
              onChange={(e) => setEvidence((prev) => ({ ...prev, hasHumanEscalation: e.target.value === "" ? null : e.target.value === "yes" }))}
            >
              <option value="">Unknown</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>
          {evidence.hasHumanEscalation && (
            <label className="block space-y-1">
              <span className="text-sm font-medium">Briefly describe the escalation process</span>
              <textarea
                className="w-full rounded border px-3 py-2 text-sm"
                rows={2}
                value={evidence.escalationDescription ?? ""}
                onChange={(e) => setEvidence((prev) => ({ ...prev, escalationDescription: e.target.value }))}
              />
            </label>
          )}
          {status === "error" && error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setSystemType(null)} className="rounded border px-4 py-2 text-sm">
              Back
            </button>
            <button
              disabled={status === "submitting"}
              onClick={handleSubmit}
              className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
              {status === "submitting" ? "Submitting…" : "Submit for review"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
