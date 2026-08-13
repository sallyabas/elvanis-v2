/**
 * Digital Presence check, scoped for an already-signed-in client
 * (confirmed 2026-08-14, item 7 of the old-Elvanis-inspired batch) —
 * deliberately narrower than the original spec's "Digital Presence Scan"
 * feature (company name/URL input, no login, public signal scraping,
 * B2B/C-aware scoring), which stays genuinely deferred for the three real
 * reasons already documented in CLAUDE.md (the only unauthenticated public
 * surface in this app; real ToS questions around scraping third-party
 * review/social sites; no defined scoring rubric with real thresholds).
 * This is a smaller, real, buildable-now piece: a plain-fetch technical-SEO
 * check on the client's OWN already-registered website (universal
 * standard, no B2B/B2C judgment needed), plus a presence check
 * (existence/linkage only, never content scraping) of social/review
 * channels linked from that site.
 *
 * Honest, disclosed limitation, confirmed before building: this is a plain
 * HTTP fetch, not a headless browser — a JS-rendered single-page site with
 * no server-rendered HTML will show false negatives on every check here
 * (no real `<title>`/meta tags in the raw response). Shipped anyway, per
 * explicit confirmation, with that limitation surfaced directly in the
 * UI, not silently under-covered.
 *
 * Never persisted (deliberately) — this is a real-time, on-demand check,
 * not a new feature surface layered onto the still-deferred
 * `digital_presence_scans` table, which belongs to the bigger, still-
 * unbuilt public scan feature and shouldn't be quietly repurposed here.
 */

const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 2_000_000; // 2MB — enough for any real homepage's <head>, bounded against a pathological response.
const USER_AGENT = "ElvanisDigitalPresenceCheck/1.0 (+https://app.elvanis.com)";

export interface TechnicalSeoCheck {
  https: boolean;
  hasTitle: boolean;
  titleText: string | null;
  hasMetaDescription: boolean;
  hasViewportMeta: boolean;
  hasCanonical: boolean;
  hasH1: boolean;
  robotsTxtReachable: boolean;
  sitemapXmlReachable: boolean;
}

export interface SocialChannelCheck {
  platform: string;
  url: string;
  reachable: boolean;
}

export interface DigitalPresenceResult {
  websiteUrl: string;
  fetchedSuccessfully: boolean;
  error?: string;
  technicalSeo: TechnicalSeoCheck | null;
  socialChannels: SocialChannelCheck[];
}

const KNOWN_CHANNELS: { platform: string; domains: string[] }[] = [
  { platform: "LinkedIn", domains: ["linkedin.com"] },
  { platform: "X / Twitter", domains: ["twitter.com", "x.com"] },
  { platform: "Facebook", domains: ["facebook.com"] },
  { platform: "Instagram", domains: ["instagram.com"] },
  { platform: "Trustpilot", domains: ["trustpilot.com"] },
  { platform: "G2", domains: ["g2.com"] },
  { platform: "Capterra", domains: ["capterra.com"] },
  { platform: "Glassdoor", domains: ["glassdoor.com"] },
];

/**
 * Basic SSRF guard — this fetches a server-supplied-by-the-client URL, so
 * a client could in principle point `website_url` at an internal address.
 * A real, disclosed, deliberately simple first line of defense: reject
 * localhost/private-range literals before ever issuing a request. This
 * does NOT protect against DNS rebinding (a public hostname that resolves
 * to a private IP at request time) — a fuller mitigation would need to
 * resolve DNS and check the resulting IP before connecting, which fetch()
 * doesn't expose a hook for without a custom agent. Flagged as a real,
 * accepted gap for this MVP pass, not silently assumed safe.
 */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  return false;
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, headers: { "User-Agent": USER_AGENT, ...(init?.headers ?? {}) } });
  } finally {
    clearTimeout(timeout);
  }
}

async function readBodyBounded(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return await response.text();
  const decoder = new TextDecoder();
  let result = "";
  let total = 0;
  while (total < MAX_BODY_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    result += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => {});
  return result;
}

function checkTechnicalSeo(html: string, finalUrl: string): TechnicalSeoCheck {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const titleText = titleMatch ? titleMatch[1].trim() : null;
  return {
    https: finalUrl.startsWith("https://"),
    hasTitle: !!titleText,
    titleText,
    hasMetaDescription: /<meta\s+[^>]*name=["']description["'][^>]*content=["'][^"']+["']/i.test(html) || /<meta\s+[^>]*content=["'][^"']+["'][^>]*name=["']description["']/i.test(html),
    hasViewportMeta: /<meta\s+[^>]*name=["']viewport["']/i.test(html),
    hasCanonical: /<link\s+[^>]*rel=["']canonical["']/i.test(html),
    hasH1: /<h1[\s>]/i.test(html),
    robotsTxtReachable: false, // filled in by caller
    sitemapXmlReachable: false, // filled in by caller
  };
}

function findSocialChannelUrls(html: string, baseOrigin: string): { platform: string; url: string }[] {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const found = new Map<string, string>();
  for (const href of hrefs) {
    let absolute: URL;
    try {
      absolute = new URL(href, baseOrigin);
    } catch {
      continue;
    }
    for (const channel of KNOWN_CHANNELS) {
      if (found.has(channel.platform)) continue;
      if (channel.domains.some((d) => absolute.hostname.toLowerCase().endsWith(d))) {
        found.set(channel.platform, absolute.toString());
      }
    }
  }
  return [...found.entries()].map(([platform, url]) => ({ platform, url }));
}

async function checkReachable(url: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(url, { method: "HEAD", redirect: "follow" });
    if (res.status === 405 || res.status === 501) {
      // Some sites (esp. review/social platforms) reject HEAD outright — fall back to a bounded GET, never reading past the response headers.
      const getRes = await fetchWithTimeout(url, { method: "GET", redirect: "follow" });
      return getRes.ok;
    }
    return res.ok;
  } catch {
    return false;
  }
}

export async function runDigitalPresenceCheck(websiteUrl: string): Promise<DigitalPresenceResult> {
  let parsed: URL;
  try {
    parsed = new URL(websiteUrl);
  } catch {
    return { websiteUrl, fetchedSuccessfully: false, error: "Not a valid URL.", technicalSeo: null, socialChannels: [] };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { websiteUrl, fetchedSuccessfully: false, error: "Only http/https URLs are supported.", technicalSeo: null, socialChannels: [] };
  }
  if (isBlockedHost(parsed.hostname)) {
    return { websiteUrl, fetchedSuccessfully: false, error: "This host cannot be checked.", technicalSeo: null, socialChannels: [] };
  }

  try {
    const response = await fetchWithTimeout(parsed.toString(), { redirect: "follow" });
    if (!response.ok) {
      return { websiteUrl, fetchedSuccessfully: false, error: `Site returned HTTP ${response.status}.`, technicalSeo: null, socialChannels: [] };
    }
    const finalUrl = response.url || parsed.toString();
    const html = await readBodyBounded(response);
    const technicalSeo = checkTechnicalSeo(html, finalUrl);

    const origin = new URL(finalUrl).origin;
    const [robotsOk, sitemapOk] = await Promise.all([checkReachable(`${origin}/robots.txt`), checkReachable(`${origin}/sitemap.xml`)]);
    technicalSeo.robotsTxtReachable = robotsOk;
    technicalSeo.sitemapXmlReachable = sitemapOk;

    const channelCandidates = findSocialChannelUrls(html, finalUrl);
    const socialChannels: SocialChannelCheck[] = await Promise.all(
      channelCandidates.map(async (c) => ({ platform: c.platform, url: c.url, reachable: await checkReachable(c.url) })),
    );

    return { websiteUrl, fetchedSuccessfully: true, technicalSeo, socialChannels };
  } catch (e) {
    const message = e instanceof Error && e.name === "AbortError" ? "Timed out reaching this site." : "Could not reach this site.";
    return { websiteUrl, fetchedSuccessfully: false, error: message, technicalSeo: null, socialChannels: [] };
  }
}
