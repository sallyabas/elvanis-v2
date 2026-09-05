"use client";

import { useState } from "react";
import { Button } from "@/app/_components/ui/Button";
import { Input } from "@/app/_components/ui/Input";
import { Textarea } from "@/app/_components/ui/Textarea";
import { Alert } from "@/app/_components/ui/Alert";
import { markFrameworkReviewedAction, updateRegulatoryFrameworkAction } from "./actions";
import type { RegulatoryFrameworkWithStatus } from "@/lib/reviewer/regulatory-frameworks";

const STATUS_STYLES: Record<RegulatoryFrameworkWithStatus["status"], string> = {
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  green: "bg-green-50 text-green-700 border-green-200",
};

/**
 * One framework row, client-side so "Mark as reviewed" can show the
 * brief's own specified confirmation text ("Marked as reviewed. Next
 * review due in [X] days.") without a full page reload losing that
 * transient message — same reentrancy-safe try/catch/finally pattern
 * already established for every other reviewer action button this
 * session (confirmed 2026-08-16, the uncaught-RPC-failure-class sweep).
 */
export function FrameworkRow({ framework }: { framework: RegulatoryFrameworkWithStatus }) {
  const [reviewNotes, setReviewNotes] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [sourceUrl, setSourceUrl] = useState(framework.sourceUrl ?? "");
  const [threshold, setThreshold] = useState(String(framework.stalenessThresholdDays));

  async function handleMarkReviewed() {
    setPending(true);
    setError(null);
    setConfirmation(null);
    try {
      const formData = new FormData();
      formData.set("reviewNotes", reviewNotes);
      const result = await markFrameworkReviewedAction(framework.id, formData);
      setConfirmation(`Marked as reviewed. Next review due in ${result.nextReviewDueDays} days.`);
      setReviewNotes("");
    } catch {
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleSaveEdit() {
    setPending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("sourceUrl", sourceUrl);
      formData.set("stalenessThresholdDays", threshold);
      await updateRegulatoryFrameworkAction(framework.id, formData);
      setEditing(false);
    } catch {
      setError("Something went wrong reaching the server — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-4 shadow-card-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-neutral-900">
            {framework.name} <span className="text-sm font-normal text-neutral-500">· {framework.jurisdiction}</span>
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {framework.applicableModules.map((m) => (
              <span key={m} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                {m}
              </span>
            ))}
          </div>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[framework.status]}`}>
          {framework.status === "red" ? "Overdue" : framework.status === "amber" ? "Due soon" : "Current"}
        </span>
      </div>

      <p className="mt-2 text-sm text-neutral-600">
        {framework.lastReviewedAt ? (
          <>
            Last reviewed {new Date(framework.lastReviewedAt).toLocaleDateString()} ({framework.daysSinceReview}d ago) by{" "}
            {framework.lastReviewedBy ?? "unknown"} · {framework.stalenessThresholdDays}d threshold
          </>
        ) : (
          <span className="font-medium text-red-700">Review pending — never reviewed under this tracker</span>
        )}
      </p>
      {framework.reviewNotes && <p className="mt-1 text-xs italic text-neutral-500">Last review notes: {framework.reviewNotes}</p>}

      <div className="mt-2 text-sm">
        {framework.sourceUrl ? (
          <a href={framework.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            Source ↗
          </a>
        ) : (
          <span className="text-neutral-400">No source URL set yet</span>
        )}
        <button type="button" onClick={() => setEditing((e) => !e)} className="ml-3 text-xs text-neutral-500 hover:underline">
          {editing ? "Cancel edit" : "Edit source & threshold"}
        </button>
      </div>

      {editing && (
        <div className="mt-2 space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
          <Input label="Source URL" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." />
          <Input label="Staleness threshold (days)" type="number" min={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
          <Button type="button" size="sm" disabled={pending} onClick={handleSaveEdit}>
            Save
          </Button>
        </div>
      )}

      <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
        <Textarea
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          placeholder="Review notes (optional) — what changed, what was checked"
          rows={2}
        />
        <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={handleMarkReviewed}>
          {pending ? "Marking…" : "Mark as reviewed"}
        </Button>
        {confirmation && (
          <Alert variant="success" className="py-2 text-xs">
            {confirmation}
          </Alert>
        )}
        {error && (
          <Alert variant="error" className="py-2 text-xs">
            {error}
          </Alert>
        )}
      </div>
    </li>
  );
}
