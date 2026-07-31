import type { LensModule } from "./types";

// Execution/Operating lens prompt + schema — Phase 1 work (roadmap §4), not yet written.
export const executionLens: LensModule = {
  lens: "execution",
  async runDraft() {
    throw new Error("executionLens.runDraft: prompt not yet implemented (Phase 1)");
  },
};
