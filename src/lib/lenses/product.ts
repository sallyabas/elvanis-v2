import type { LensModule } from "./types";

// Product/Customer lens prompt + schema — Phase 1 work (roadmap §4), not yet written.
export const productLens: LensModule = {
  lens: "product",
  async runDraft() {
    throw new Error("productLens.runDraft: prompt not yet implemented (Phase 1)");
  },
};
