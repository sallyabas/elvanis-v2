import type { LensDraftInput, LensDraftResult, LensModule } from "./types";

// Commercial/Market lens prompt + schema — Phase 1 work (roadmap §4), not yet written.
export const commercialLens: LensModule = {
  lens: "commercial",
  async runDraft(_input: LensDraftInput): Promise<LensDraftResult> {
    throw new Error("commercialLens.runDraft: prompt not yet implemented (Phase 1)");
  },
};
