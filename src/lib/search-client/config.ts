/**
 * Single source of truth for which search provider backs live-research
 * calls (currently Commercial/Market's independent research step). Change
 * the provider here (or via env) — never at a call site.
 */
export const searchConfig = {
  provider: process.env.SEARCH_PROVIDER ?? "tavily",
  defaultMaxResults: 5,
} as const;
