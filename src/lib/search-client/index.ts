import { searchConfig } from "./config";
import { TavilyProvider } from "./providers/tavily";
import type { SearchProvider, SearchQuery, SearchResult } from "./types";

export { SearchClientError } from "./types";
export type { SearchQuery, SearchResult, SearchResultItem } from "./types";

/**
 * The search-client abstraction. This is the ONLY place in the codebase
 * allowed to import a search provider SDK/API (Tavily today). Every caller
 * (currently Commercial/Market's independent research step) must call
 * `search` from here — never a provider directly. Swapping providers is a
 * change to `config.ts` + adding a provider file, not a rewrite of call
 * sites — same discipline as src/lib/ai-client for Groq.
 */
let cachedProvider: SearchProvider | undefined;

function getProvider(): SearchProvider {
  if (cachedProvider) return cachedProvider;

  switch (searchConfig.provider) {
    case "tavily":
      cachedProvider = new TavilyProvider();
      break;
    default:
      throw new Error(`Unknown search provider configured: "${searchConfig.provider}"`);
  }

  return cachedProvider;
}

export async function search(query: SearchQuery): Promise<SearchResult> {
  return getProvider().search(query);
}
