/**
 * Curated, deterministic procurement-question categories (confirmed
 * 2026-08-04, Priority 3) — split out from procurement-answers.ts so this
 * data (category keys, labels, question text) can be imported by BOTH the
 * server-side generator and the reviewer workspace client component
 * without pulling server-only code (createAdminClient, generateValidatedJson)
 * into the client bundle. procurement-answers.ts re-exports these for
 * backwards-compat callers.
 */

export type ProcurementCategory =
  | "compliance_posture_risk_classification"
  | "data_governance_subject_rights"
  | "model_governance_version_control"
  | "audit_trail_logging"
  | "human_oversight_hitl"
  | "incident_breach_reporting"
  | "sub_processor_disclosure"
  | "security_certifications"
  | "data_residency_cross_border"
  | "termination_posture"
  | "ongoing_review_commitment";

export const PROCUREMENT_QUESTIONS: Record<ProcurementCategory, { label: string; question: string }> = {
  compliance_posture_risk_classification: {
    label: "Compliance posture & risk classification",
    question:
      "What is your AI system's risk classification under applicable regulatory frameworks (e.g. EU AI Act, UAE DIFC Regulation 10, Saudi SDAIA principles), and what is the basis for that classification?",
  },
  data_governance_subject_rights: {
    label: "Data governance & subject rights",
    question:
      "How is personal data used to train, fine-tune, or operate your AI system governed, and how do you support data subject rights (access, correction, deletion) for data processed by the AI system?",
  },
  model_governance_version_control: {
    label: "Model governance & version control",
    question: "How do you track, version, and govern changes to the AI models in production, including retraining or fine-tuning events?",
  },
  audit_trail_logging: {
    label: "Audit trail & logging",
    question: "What logging and audit trail capabilities exist for your AI system's decisions and actions, and how long are these logs retained?",
  },
  human_oversight_hitl: {
    label: "Human oversight (HITL)",
    question: "What human oversight exists for AI-generated outputs before they affect a customer or business decision, and is that oversight mandatory or optional?",
  },
  incident_breach_reporting: {
    label: "Incident & breach reporting",
    question:
      "What is your process for detecting, escalating, and reporting AI-related incidents (including failures, bias events, or data breaches), and what are your notification timelines?",
  },
  sub_processor_disclosure: {
    label: "Sub-processor disclosure",
    question: "Which third-party AI model providers, hosting providers, or other sub-processors are involved in delivering this AI system, and how are they vetted?",
  },
  security_certifications: {
    label: "Security certifications",
    question: "What security certifications or independent audits (e.g. SOC 2, ISO 27001) apply to the infrastructure and providers used by your AI system?",
  },
  data_residency_cross_border: {
    label: "Data residency / cross-border",
    question: "Where is data processed and stored by your AI system, and what safeguards apply to any cross-border transfers?",
  },
  termination_posture: {
    label: "Termination posture",
    question: "What happens to data processed by the AI system, and to the AI system's access, upon contract termination?",
  },
  ongoing_review_commitment: {
    label: "Ongoing review commitment",
    question: "How frequently do you review and reassess your AI system's risk classification, governance controls, and regulatory compliance?",
  },
};
