import { financialLens } from "./financial";
import { commercialLens } from "./commercial";
import { executionLens } from "./execution";
import { productLens } from "./product";
import { aiGovernanceLens } from "./ai-governance";
import type { LensModule, LensType } from "./types";

export type { LensType, LensFindingDraft, ConfidenceLevel, LensModule } from "./types";

/** All five lenses, always run at equal depth (see spec §2.1). */
export const lensRegistry: Record<LensType, LensModule> = {
  financial: financialLens,
  commercial: commercialLens,
  execution: executionLens,
  product: productLens,
  ai_governance: aiGovernanceLens,
};
