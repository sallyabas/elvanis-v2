import type { LensModule } from "./types";

// Financial lens prompt + schema — Phase 1 work (roadmap §4), not yet written.
export const financialLens: LensModule = {
  lens: "financial",
  async runDraft() {
    throw new Error("financialLens.runDraft: prompt not yet implemented (Phase 1)");
  },
};
