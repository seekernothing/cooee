const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 8000;

export interface ShopifyProduct {
  id: number;
  title: string;
  handle: string;
  vendor: string;
  product_type: string;
  price: string | null;
  compareAtPrice: string | null;
  image: string | null;
  url: string;
}

/** Which platform the homepage HTML says this is. */
export type Platform = "shopify" | "unknown";

/**
 * Whether we actually got a catalog, and if not, why:
 * - `ok`      — products.json returned products
 * - `blocked` — bot wall / rate limit (403, 429, edge challenge). Store is
 *               live and probably Shopify; the endpoint just refused us.
 * - `empty`   — valid Shopify catalog with zero published products
 * - `none`    — not a Shopify catalog at all (404, HTML, bad JSON)
 */
export type CatalogStatus = "ok" | "blocked" | "empty" | "none";

export interface ShopifyStoreData {
  catalog: CatalogStatus;
  products: ShopifyProduct[];
}

/**
 * Markers Shopify leaves in served HTML. Checked against the homepage, which
 * we already fetch for metadata — so this costs nothing extra and still
 * identifies stores whose /products.json is bot-protected.
 */
const SHOPIFY_MARKERS =
  /cdn\.shopify\.com|Shopify\.theme|shopify-features|myshopify\.com|\/cdn\/shop\//i;

export function detectPlatform(html: string | null): Platform {
  if (!html) return "unknown";
  return SHOPIFY_MARKERS.test(html) ? "shopify" : "unknown";
}

/**
 * Accepts `store.com`, `www.store.com`, `https://store.com/collections/all`.
 * Returns a clean `https://hostname` origin.
 * Throws on genuinely unparseable input — callers turn that into a 400.
 */
export function normalizeStoreUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a store URL.");

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed.replace(/^\/+/, "")}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new Error(`"${input}" isn't a valid URL.`);
  }

  // A hostname with no dot (e.g. "localhost", "asdf") isn't a real store.
  if (!parsed.hostname.includes(".")) {
    throw new Error(`"${input}" isn't a valid store domain.`);
  }

  return `https://${parsed.hostname}`;
}

/** Shape of the public /products.json payload — only the fields we read. */
interface RawShopifyProduct {
  id?: number;
  title?: string;
  handle?: string;
  vendor?: string;
  product_type?: string;
  variants?: Array<{ price?: string | null; compare_at_price?: string | null }>;
  images?: Array<{ src?: string | null }>;
}

/**
 * Shopify storefronts publicly expose their catalog at /products.json.
 *
 * Never throws. Verified against live stores: Allbirds and Rothy's return 200
 * with full catalogs, Gymshark 403s and Bombas 429s at the edge regardless of
 * User-Agent (tested Chrome 124/131, a bot string, and no UA — identical), so
 * `blocked` is a terminal state we report honestly rather than retry around.
 */
export async function fetchShopifyProducts(
  origin: string,
  limit = 12,
): Promise<ShopifyStoreData> {
  try {
    const res = await fetch(`${origin}/products.json?limit=${limit}`, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });

    // Bot walls and rate limits — the store is live, we're just refused.
    if (res.status === 403 || res.status === 429 || res.status === 401) {
      return { catalog: "blocked", products: [] };
    }

    // Cloudflare-style edge challenges surface as 5xx on an otherwise live site.
    if (res.status >= 500) return { catalog: "blocked", products: [] };

    if (!res.ok) return { catalog: "none", products: [] };

    // Some non-Shopify sites 200 with an HTML soft-404 on any path.
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return { catalog: "none", products: [] };

    const data: unknown = await res.json();
    if (
      typeof data !== "object" ||
      data === null ||
      !Array.isArray((data as { products?: unknown }).products)
    ) {
      return { catalog: "none", products: [] };
    }

    const raw = (data as { products: RawShopifyProduct[] }).products;
    const products = raw
      .filter((p): p is RawShopifyProduct => typeof p === "object" && p !== null)
      .map((p) => mapProduct(p, origin))
      .filter((p): p is ShopifyProduct => p !== null);

    // A valid catalog contract with nothing published is `empty`, not `ok` —
    // downstream must not claim a working catalog it can't show products from.
    return {
      catalog: products.length > 0 ? "ok" : "empty",
      products,
    };
  } catch {
    // Timeout or DNS failure. The homepage scrape decides whether the site
    // is reachable at all; from here we only know we got no catalog.
    return { catalog: "blocked", products: [] };
  }
}

function mapProduct(
  raw: RawShopifyProduct,
  origin: string,
): ShopifyProduct | null {
  if (typeof raw.id !== "number" || !raw.handle || !raw.title) return null;

  const variant = raw.variants?.[0];
  const price = normalizePrice(variant?.price);
  const compareAtPrice = normalizePrice(variant?.compare_at_price);
  const image = raw.images?.[0]?.src ?? null;

  return {
    id: raw.id,
    title: raw.title,
    handle: raw.handle,
    vendor: raw.vendor ?? "",
    product_type: raw.product_type ?? "",
    price,
    compareAtPrice,
    image: image ? image.trim() : null,
    url: `${origin}/products/${raw.handle}`,
  };
}

/** Prices arrive as strings like "95.00"; keep them as-is, drop empties. */
function normalizePrice(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Only products we can actually render in a widget: image + price. */
export function pickFeaturedProducts(
  products: ShopifyProduct[],
  count = 3,
): ShopifyProduct[] {
  return products.filter((p) => p.image && p.price).slice(0, count);
}
