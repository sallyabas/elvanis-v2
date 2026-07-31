import type { LensModule } from "./types";

// AI & Governance lens — questionnaire mode + document-review mode branch.
// Phase 1 work (roadmap §4), not yet written.
export const aiGovernanceLens: LensModule = {
  lens: "ai_governance",
  async runDraft() {
    throw new Error("aiGovernanceLens.runDraft: prompt not yet implemented (Phase 1)");
  },
};
