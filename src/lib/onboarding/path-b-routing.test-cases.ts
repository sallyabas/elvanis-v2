/**
 * Committed, runnable test suite for computePathBRouting() — confirmed
 * 2026-08-27, same pattern as jurisdiction.test-cases.ts. Run via:
 *   npx tsx --env-file=.env.local src/lib/onboarding/path-b-routing.test-cases.ts
 */
import { computePathBRouting, type TriageAiUsage, type TriageComplianceRequest, type TriagePersonalData } from "./path-b-routing";

interface Case {
  name: string;
  ai: TriageAiUsage;
  compliance: TriageComplianceRequest;
  personalData: TriagePersonalData;
  expectPrimaryKind: "module" | "consultation" | "core_audit";
  expectPrimaryModule?: string;
  expectPrimaryUrgent?: boolean;
  expectAdditionalModules: string[];
}

const cases: Case[] = [
  {
    name: "customer-facing AI + active request -> Tender Readiness, urgent",
    ai: "customer_facing",
    compliance: "active_request",
    personalData: "no",
    expectPrimaryKind: "module",
    expectPrimaryModule: "tender_readiness",
    expectPrimaryUrgent: true,
    expectAdditionalModules: [],
  },
  {
    name: "internal-only AI + active request -> Tender Readiness, urgent",
    ai: "internal_only",
    compliance: "active_request",
    personalData: "no",
    expectPrimaryKind: "module",
    expectPrimaryModule: "tender_readiness",
    expectPrimaryUrgent: true,
    expectAdditionalModules: [],
  },
  {
    name: "exploring + active request -> human consultation, urgent (the refinement's fix, not silently core_audit)",
    ai: "exploring",
    compliance: "active_request",
    personalData: "no",
    expectPrimaryKind: "consultation",
    expectPrimaryUrgent: true,
    expectAdditionalModules: [],
  },
  {
    name: "not_sure AI + active request -> human consultation, urgent",
    ai: "not_sure",
    compliance: "active_request",
    personalData: "no",
    expectPrimaryKind: "consultation",
    expectPrimaryUrgent: true,
    expectAdditionalModules: [],
  },
  {
    name: "customer-facing AI + no active request -> AI Reliability Audit",
    ai: "customer_facing",
    compliance: "want_ahead",
    personalData: "no",
    expectPrimaryKind: "module",
    expectPrimaryModule: "ai_reliability",
    expectPrimaryUrgent: false,
    expectAdditionalModules: [],
  },
  {
    name: "internal-only AI + not_applicable -> AI Reliability Audit",
    ai: "internal_only",
    compliance: "not_applicable",
    personalData: "no",
    expectPrimaryKind: "module",
    expectPrimaryModule: "ai_reliability",
    expectPrimaryUrgent: false,
    expectAdditionalModules: [],
  },
  {
    name: "exploring + not_applicable -> core_audit (Path A via Path B)",
    ai: "exploring",
    compliance: "not_applicable",
    personalData: "no",
    expectPrimaryKind: "core_audit",
    expectAdditionalModules: [],
  },
  {
    name: "not_sure + want_ahead -> core_audit",
    ai: "not_sure",
    compliance: "want_ahead",
    personalData: "no",
    expectPrimaryKind: "core_audit",
    expectAdditionalModules: [],
  },
  {
    name: "personal data = yes surfaces Data Protection Compliance alongside a real AI-usage primary route (never inferred from Q1)",
    ai: "customer_facing",
    compliance: "want_ahead",
    personalData: "yes",
    expectPrimaryKind: "module",
    expectPrimaryModule: "ai_reliability",
    expectPrimaryUrgent: false,
    expectAdditionalModules: ["data_protection"],
  },
  {
    name: "personal data = not_sure also surfaces Data Protection Compliance (cautious default)",
    ai: "exploring",
    compliance: "not_applicable",
    personalData: "not_sure",
    expectPrimaryKind: "core_audit",
    expectAdditionalModules: ["data_protection"],
  },
  {
    name: "personal data = no -> no additional recommendation",
    ai: "customer_facing",
    compliance: "want_ahead",
    personalData: "no",
    expectPrimaryKind: "module",
    expectPrimaryModule: "ai_reliability",
    expectPrimaryUrgent: false,
    expectAdditionalModules: [],
  },
  {
    name: "personal data = yes + urgent active-request row still surfaces Data Protection Compliance as additional (independent axis)",
    ai: "customer_facing",
    compliance: "active_request",
    personalData: "yes",
    expectPrimaryKind: "module",
    expectPrimaryModule: "tender_readiness",
    expectPrimaryUrgent: true,
    expectAdditionalModules: ["data_protection"],
  },
];

let failed = 0;
for (const c of cases) {
  const result = computePathBRouting(c.ai, c.compliance, c.personalData);
  const problems: string[] = [];

  if (result.primary.kind !== c.expectPrimaryKind) {
    problems.push(`primary.kind: expected ${c.expectPrimaryKind}, got ${result.primary.kind}`);
  }
  if (c.expectPrimaryModule && result.primary.kind === "module" && result.primary.module !== c.expectPrimaryModule) {
    problems.push(`primary.module: expected ${c.expectPrimaryModule}, got ${result.primary.module}`);
  }
  if (c.expectPrimaryUrgent !== undefined && "urgent" in result.primary && result.primary.urgent !== c.expectPrimaryUrgent) {
    problems.push(`primary.urgent: expected ${c.expectPrimaryUrgent}, got ${(result.primary as { urgent: boolean }).urgent}`);
  }
  const additionalModules = result.additional.filter((r) => r.kind === "module").map((r) => (r as { module: string }).module);
  if (JSON.stringify(additionalModules.sort()) !== JSON.stringify([...c.expectAdditionalModules].sort())) {
    problems.push(`additional modules: expected [${c.expectAdditionalModules.join(", ")}], got [${additionalModules.join(", ")}]`);
  }

  if (problems.length > 0) {
    failed++;
    console.error(`FAIL: ${c.name}\n  ${problems.join("\n  ")}`);
  } else {
    console.log(`PASS: ${c.name}`);
  }
}

console.log(`\n${cases.length - failed}/${cases.length} passing`);
if (failed > 0) process.exit(1);
