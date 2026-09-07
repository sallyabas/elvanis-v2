import type { ConfidenceLevel, GoalRelevance, LensFinding, LensType, Severity, PrimaryGoal } from "@/lib/lenses/types";
import { GOAL_LABELS } from "@/lib/lenses/goals";
import { humanizeStatus } from "@/lib/format";
import type { RecommendationLibraryEntry } from "@/lib/recommendations/recommendation-library";

/**
 * ReviewWorkspaceClient.tsx decomposition (confirmed 2026-09-07) — shared
 * data shapes, display constants, and pure helpers, extracted from the
 * former single 1567-line file. Every sub-component and section component
 * imports from here rather than redeclaring its own copy, so the row/
 * finding/conflict shapes can't drift between files the way they never
 * could when this was all one component.
 */

export interface FindingRow {
  id: string;
  lens: LensType;
  ai_draft: LensFinding;
  reviewer_edited_content: LensFinding | null;
  reviewer_status: "draft" | "edited" | "approved" | "rejected";
  reviewer_notes: string | null;
  confidence_level: ConfidenceLevel | null;
  is_missing_data_finding: boolean;
  origin: string | null;
  client_confidence_marking: string | null;
  is_disputed: boolean;
  dispute_resolution_notes: string | null;
}

export interface ConflictRow {
  id: string;
  finding_a_id: string;
  finding_b_id: string;
  conflict_description: string;
  /** Nullable — older conflicts predate this field (confirmed 2026-08-12); always populated going forward. */
  ai_suggested_resolution: string | null;
  resolution_status: "unresolved" | "reviewer_resolved";
  reviewer_notes: string | null;
}

export interface TimingInfo {
  createdAt: string;
  submittedAt: string | null;
  editWindowClosesAt: string | null;
  approvedAt: string | null;
}

/**
 * Reviewer-authored finding note (confirmed 2026-08-24, Concierge tier
 * build) — a lightweight local shape, deliberately not importing
 * FindingConciergeNote from lib/reviewer/finding-notes.ts directly, since
 * that module imports the server-only admin client at module scope and
 * has no business being pulled into a client bundle.
 */
export interface ConciergeNote {
  authorName: string;
  note: string;
  updatedAt: string;
}

/**
 * Reviewer second opinion (confirmed 2026-09-04) — a lightweight local
 * shape, same reasoning as ConciergeNote above (the server-only
 * second-opinion-workspace.ts module has no business in a client bundle).
 * v1 scope: Financial lens only — real, server-side enforcement lives in
 * requestFinancialLensSecondOpinion(), not just this component only
 * rendering the button for that lens.
 */
export type SecondOpinionCategory =
  | "possible_duplicate"
  | "unsupported_confidence"
  | "healthy_finding_miscategorized"
  | "goal_relevance_mismatch"
  | "unactionable_recommendation"
  | "other";

export interface SecondOpinionDisplay {
  concern: boolean;
  category: SecondOpinionCategory | null;
  reasoning: string;
  model: string;
}

export const SECOND_OPINION_CATEGORY_LABELS: Record<SecondOpinionCategory, string> = {
  possible_duplicate: "Possible duplicate",
  unsupported_confidence: "Unsupported confidence",
  healthy_finding_miscategorized: "Healthy finding miscategorized",
  goal_relevance_mismatch: "Goal-relevance mismatch",
  unactionable_recommendation: "Unactionable recommendation",
  other: "Other concern",
};

/**
 * Reviewer report-level second opinion (confirmed 2026-09-04) — a real,
 * separate feature from the per-finding one above, checking the report's
 * actual Top 3 selection against the client's stated goal. Same
 * lightweight local-shape reasoning as SecondOpinionDisplay.
 */
export type ReportSecondOpinionCategory =
  | "missing_fix_first_finding"
  | "healthy_finding_in_top3"
  | "top3_misaligned_with_goal"
  | "recommendations_dont_match_goal"
  | "other";

export interface ReportSecondOpinionConcernDisplay {
  category: ReportSecondOpinionCategory;
  findingIds: string[];
  reasoning: string;
}

export interface ReportSecondOpinionDisplay {
  concerns: ReportSecondOpinionConcernDisplay[];
  overallAssessment: string;
  model: string;
}

export const REPORT_SECOND_OPINION_CATEGORY_LABELS: Record<ReportSecondOpinionCategory, string> = {
  missing_fix_first_finding: "Missing fix-first finding",
  healthy_finding_in_top3: "Healthy finding in Top 3",
  top3_misaligned_with_goal: "Top 3 misaligned with goal",
  recommendations_dont_match_goal: "Recommendations don't match goal",
  other: "Other concern",
};

/** EditForm's own output shape — shared with DisputeResolutionForm's "edit" resolution path and both orchestrator handler signatures (handleSaveEdit/handleResolveDispute), so it lives here rather than colocated with just one of those three consumers. */
export interface EditFormValues {
  title: string;
  diagnosis: string;
  rootCause: string;
  recommendedAction: string;
  severity: Severity;
  confidenceLevel: ConfidenceLevel;
  goalRelevance: GoalRelevance;
}

export interface Props {
  reportId: string;
  companyName: string;
  companyUserId: string | null;
  planTier: string;
  reportStatus: string;
  /**
   * Real gap closed (confirmed 2026-09-03) — which of the 5 lenses
   * genuinely failed to run during this audit, persisted for the first
   * time (see run-audit.ts). Non-empty means the report is provably
   * incomplete, not just thin — approveReport() now hard-blocks on this
   * server-side too; the banner below just makes the reason visible
   * before the reviewer even tries.
   */
  failedLenses: string[];
  /**
   * Real, new (confirmed 2026-09-03, direct founder request) — see
   * regulatory-staleness.ts's own docblock for the full design: an
   * AMBIENT signal about the company's current profile, computed in
   * page.tsx, never a claim about this specific report's own findings
   * (the core audit never does formal jurisdiction determination — see
   * the warning's own copy below for the exact framing).
   */
  regulatoryStalenessWarnings: { shortCode: string; label: string; daysSinceReview: number | null; status: "red" | "amber" }[];
  top3FindingIds: string[];
  canRerun: boolean;
  rerunOfReportId: string | null;
  similarPatterns: { companyId: string; companyName: string; reportId: string; overlappingTags: string[]; similarityScore: number }[];
  findings: FindingRow[];
  conflicts: ConflictRow[];
  timing: TimingInfo;
  /**
   * DB-backed as of 2026-08-06 (see recommendations/repository.ts) —
   * fetched server-side in page.tsx and passed down here, since
   * RECOMMENDATION_LIBRARY can no longer be imported directly into this
   * client component now that it's an async DB read. Threaded through to
   * EditForm below, same pattern as GOVERNANCE_DIMENSIONS in
   * EvidenceIntakeForm.
   */
  recommendationLibrary: RecommendationLibraryEntry[];
  /** Concierge tier build (confirmed 2026-08-24) — keyed by findingId, one query in page.tsx, not N. */
  conciergeNotesByFindingId: Record<string, ConciergeNote>;
  /** Prefills the "Your name" field when adding a note — real session lookup in page.tsx, may be blank. */
  currentReviewerName: string;
  /** Reviewer second opinion (confirmed 2026-09-04) — keyed by findingId, one query in page.tsx, not N. Only ever populated for Financial-lens findings in v1. */
  secondOpinionsByFindingId: Record<string, SecondOpinionDisplay>;
  /** Reviewer report-level second opinion (confirmed 2026-09-04) — the most recent one for this report, or null if never requested. */
  reportSecondOpinion: ReportSecondOpinionDisplay | null;
}

export function displayedContent(f: FindingRow): LensFinding {
  return f.reviewer_edited_content ?? f.ai_draft;
}

// Softened 2026-08-28 (premium B2B redesign) — same restrained, no-border
// treatment as the shared SEVERITY_STYLES (@/lib/severity-badge), applied
// by extension since this workspace's own status/severity badges are the
// same conceptual pattern.
export const STATUS_BADGE: Record<FindingRow["reviewer_status"], string> = {
  draft: "bg-yellow-50 text-yellow-700 dark:bg-amber-950 dark:text-amber-300",
  approved: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-300",
  edited: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-200",
  rejected: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-300",
};

// SEVERITY_BADGE replaced by the shared SEVERITY_STYLES (@/lib/severity-badge)
// — this file previously kept its own local copy with the old saturated
// tones; now reads from the single source of truth like every other page.

export const LENS_LABELS: Record<LensType, string> = {
  financial: "Financial",
  commercial: "Commercial / Market",
  execution: "Execution / Operating",
  product: "Product / Customer",
  ai_governance: "AI & Governance",
};

export const LENS_ORDER: LensType[] = ["financial", "commercial", "execution", "product", "ai_governance"];

/**
 * Humanizes a raw `case_library` tag (confirmed 2026-08-26, navigation-
 * audit fix batch, item 4) — real gap found live: "Similar patterns"
 * rendered these internal, machine-parseable tags verbatim (e.g.
 * `goal:growth_revenue_efficiency`, `lens:financial:severity:critical`),
 * which is exactly the format case-library.ts's own tag-building functions
 * produce (`goal:`/`industry:`/`stage:`/`lens:<key>:severity:<level>`) —
 * see that file for the source of truth these patterns match against.
 * Reuses this same file's own LENS_LABELS and the shared GOAL_LABELS
 * rather than inventing new copy.
 */
export function formatOverlapTag(tag: string): string {
  const lensMatch = tag.match(/^lens:([a-z_]+):severity:([a-z]+)$/);
  if (lensMatch) {
    const [, lens, severity] = lensMatch;
    return `${LENS_LABELS[lens as LensType] ?? lens}: ${severity} severity`;
  }
  if (tag.startsWith("goal:")) {
    const goal = tag.slice("goal:".length);
    return `Goal: ${GOAL_LABELS[goal as PrimaryGoal] ?? goal}`;
  }
  if (tag.startsWith("industry:")) return `Industry: ${tag.slice("industry:".length)}`;
  if (tag.startsWith("stage:")) return `Stage: ${tag.slice("stage:".length)}`;
  return humanizeStatus(tag);
}

export function formatDuration(fromIso: string | null, toIso: string | null): string | null {
  if (!fromIso) return null;
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  const ms = to - from;
  if (ms < 0) return null;
  const totalMinutes = Math.round(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}
