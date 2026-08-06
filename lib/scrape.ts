import * as cheerio from "cheerio";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 8000;

export interface SiteMetadata {
  title: string | null;
  description: string | null;
  ogImage: string | null;
  favicon: string | null;
  themeColor: string | null;
  siteName: string | null;
}

export interface ScrapeResult {
  meta: SiteMetadata;
  /** Raw homepage HTML, for platform detection. Null if unreachable. */
  html: string | null;
  /** False only when the homepage itself couldn't be fetched at all. */
  reachable: boolean;
  /**
   * True when the site sends x-frame-options or frame-ancestors, i.e. a direct
   * iframe is guaranteed to fail. Read from headers we already fetch, so the
   * UI can skip straight past tier 1 instead of waiting out a timeout.
   */
  framingBlocked: boolean;
}

function detectFramingBlocked(headers: Headers): boolean {
  const xfo = headers.get("x-frame-options");
  if (xfo && /deny|sameorigin/i.test(xfo)) return true;

  const csp = headers.get("content-security-policy");
  if (!csp) return false;

  const directive = csp
    .split(";")
    .map((part) => part.trim())
    .find((part) => /^frame-ancestors\b/i.test(part));
  if (!directive) return false;

  // frame-ancestors with anything other than a permissive wildcard blocks us.
  return !/\*\s*$/.test(directive);
}

const EMPTY_METADATA: SiteMetadata = {
  title: null,
  description: null,
  ogImage: null,
  favicon: null,
  themeColor: null,
  siteName: null,
};

/**
 * Turns protocol-relative (`//cdn…`) and root-relative (`/img.png`) URLs into
 * absolute ones. Without this, every scraped image 404s when rendered.
 */
export function resolveUrl(
  candidate: string | null | undefined,
  base: string,
): string | null {
  if (!candidate) return null;
  const value = candidate.trim();
  if (!value) return null;

  if (value.startsWith("data:")) return value;

  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

/**
 * Generic brand signals for any site. Never throws — an unreachable or
 * unparseable page yields all-nulls so callers can still render something.
 */
export async function scrapeSiteMetadata(origin: string): Promise<ScrapeResult> {
  let html: string | null = null;
  let framingBlocked = false;

  try {
    const res = await fetch(origin, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });

    // A rate-limited or challenged homepage still proves the host resolves,
    // and its body often carries platform markers — keep it for detection.
    framingBlocked = detectFramingBlocked(res.headers);
    html = await res.text();

    if (!res.ok) {
      return { meta: { ...EMPTY_METADATA }, html, reachable: true, framingBlocked };
    }

    const $ = cheerio.load(html);

    // Resolve against the final URL after redirects, not the requested origin.
    const base = res.url || origin;

    const metaContent = (selector: string): string | null => {
      const value = $(selector).first().attr("content");
      const trimmed = value?.trim();
      return trimmed ? trimmed : null;
    };

    const title =
      metaContent('meta[property="og:title"]') ??
      $("title").first().text().trim() ??
      null;

    const description =
      metaContent('meta[name="description"]') ??
      metaContent('meta[property="og:description"]');

    const ogImage = resolveUrl(
      metaContent('meta[property="og:image"]') ??
        metaContent('meta[name="twitter:image"]'),
      base,
    );

    const faviconHref =
      $('link[rel="icon"]').first().attr("href") ??
      $('link[rel="shortcut icon"]').first().attr("href") ??
      $('link[rel="apple-touch-icon"]').first().attr("href") ??
      "/favicon.ico";

    return {
      meta: {
        title: title || null,
        description,
        ogImage,
        favicon: resolveUrl(faviconHref, base),
        themeColor: metaContent('meta[name="theme-color"]'),
        siteName: metaContent('meta[property="og:site_name"]'),
      },
      html,
      reachable: true,
      framingBlocked,
    };
  } catch {
    return {
      meta: { ...EMPTY_METADATA },
      html,
      reachable: html !== null,
      framingBlocked,
    };
  }
}
