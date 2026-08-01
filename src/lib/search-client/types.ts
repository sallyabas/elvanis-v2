export interface SearchQuery {
  query: string;
  /** Caps result count — keeps targeted competitor searches bounded, not open-ended. */
  maxResults?: number;
}

export interface SearchResultItem {
  title: string;
  url: string;
  /** Provider-generated summary/snippet — never fabricated downstream, only passed through. */
  content: string;
  publishedDate?: string;
}

export interface SearchResult {
  query: string;
  results: SearchResultItem[];
  provider: string;
}

/**
 * Every search provider (Tavily today, anything else later) implements this
 * shape. Nothing outside src/lib/search-client should import a provider SDK
 * directly — same discipline as src/lib/ai-client for Groq.
 */
export interface SearchProvider {
  readonly name: string;
  search(query: SearchQuery): Promise<SearchResult>;
}

export class SearchClientError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "SearchClientError";
  }
}
