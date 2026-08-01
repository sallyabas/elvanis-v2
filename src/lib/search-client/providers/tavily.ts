import type { SearchProvider, SearchQuery, SearchResult, SearchResultItem } from "../types";
import { SearchClientError } from "../types";

interface TavilyApiResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
}

interface TavilyApiResponse {
  query: string;
  results: TavilyApiResult[];
}

export class TavilyProvider implements SearchProvider {
  readonly name = "tavily";
  private apiKey: string;

  constructor(apiKey: string = process.env.TAVILY_API_KEY ?? "") {
    if (!apiKey) {
      throw new SearchClientError("TAVILY_API_KEY is not set", "tavily");
    }
    this.apiKey = apiKey;
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: this.apiKey,
          query: query.query,
          max_results: query.maxResults ?? 5,
          search_depth: "basic",
        }),
      });

      if (!response.ok) {
        throw new SearchClientError(`Tavily search failed with status ${response.status}`, this.name);
      }

      const data = (await response.json()) as TavilyApiResponse;

      const results: SearchResultItem[] = data.results.map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        publishedDate: r.published_date,
      }));

      return { query: query.query, results, provider: this.name };
    } catch (cause) {
      if (cause instanceof SearchClientError) throw cause;
      throw new SearchClientError("Tavily search failed", this.name, cause);
    }
  }
}
