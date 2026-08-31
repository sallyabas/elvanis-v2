import type { ConfidenceLevel, Severity } from "@/lib/lenses/types";

/**
 * AI Reliability Audit (spec §1.7a, confirmed 2026-08-02) — evidence-based,
 * no live execution against a client's AI system, consistent with §1.7's
 * no-live-integrations rule. Intake branches on system type, decided by a
 * clarifying question, not inferred.
 */
export type AiReliabilitySystemType = "conversational" | "agent_automation";

/**
 * The four researched adversarial categories (correction note 2) plus
 * "governance_gap" for the agent/automation path's accountability/
 * escalation/trace-log findings, which aren't adversarial-prompt-shaped.
 */
export type AdversarialTestCategory = "invented_policy" | "data_leakage" | "bias" | "prompt_injection" | "governance_gap";

/** One self-test prompt the client runs against their own conversational AI and pastes the real response back for. */
export interface SelfTestPrompt {
  category: AdversarialTestCategory;
  prompt: string;
  whatWereLookingFor: string;
}

/** One client-submitted transcript from running a self-test prompt. */
export interface ConversationalTranscript {
  category: AdversarialTestCategory;
  promptUsed: string;
  aiResponse: string;
}

/** Agent/automation path intake — no conversational interface to run self-test prompts against. */
export interface AgentAutomationEvidence {
  hasTraceLogs: boolean;
  traceLogsSummary: string | null;
  operatingCredentialsDescription: string | null;
  actionsAttributable: boolean | null;
  hasHumanEscalation: boolean | null;
  escalationDescription: string | null;
}

/**
 * Same four-field structure as LensFinding (diagnosis/rootCause/
 * recommendedAction/severity) — that separation was established as the
 * core value proposition for the five lenses; there's no reason an
 * AI Reliability finding should regress to a flatter shape.
 */
export interface AiReliabilityFinding {
  findingId: string;
  title: string;
  diagnosis: string;
  rootCause: string;
  recommendedAction: string;
  severity: Severity;
  category: AdversarialTestCategory;
  evidenceCited: string[];
  confidenceLevel: ConfidenceLevel;
  isMissingDataFinding: boolean;
  /**
   * Deterministic post-hoc safety net for the conversational-mode "silent
   * PASS/FAIL classification" prompt rule (confirmed 2026-08-31) — that
   * rule is genuinely prompt-only (no structural signal like hasTraceLogs'
   * boolean to filter on), so this is a second, imprecise, additive-only
   * layer: never suppresses or edits a finding, only flags one for a human
   * reviewer to double-check when its correlated transcript text reads
   * like a correct refusal/handling. Never set for category "bias" (no
   * refusal-language concept applies there — see
   * misclassification-guard.ts) or for agent/automation-mode findings
   * (that path already has a real deterministic guard,
   * dropDuplicateTraceLogFindings, and doesn't need a second one).
   */
  possibleMisclassification?: {
    reason: string;
    /** How the flagged text was correlated back to a real transcript — see misclassification-guard.ts's tiered correlation. */
    confidence: "high" | "medium" | "low";
  };
}

export interface AiReliabilityDraftInput {
  companyId: string;
  systemType: AiReliabilitySystemType;
  conversationalTranscripts?: ConversationalTranscript[];
  agentAutomationEvidence?: AgentAutomationEvidence;
}

export interface AiReliabilityDraftResult {
  systemType: AiReliabilitySystemType;
  findings: AiReliabilityFinding[];
  notes?: string;
}
