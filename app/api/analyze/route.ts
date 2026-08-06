import { NextResponse } from "next/server";
import { z } from "zod";

import { scrapeSiteMetadata, type SiteMetadata } from "@/lib/scrape";
import {
  detectPlatform,
  fetchShopifyProducts,
  normalizeStoreUrl,
  pickFeaturedProducts,
  type CatalogStatus,
  type Platform,
  type ShopifyProduct,
} from "@/lib/shopify";

export const runtime = "nodejs";
export const maxDuration = 30;

const RequestSchema = z.object({
  url: z.string().min(1, "Enter a store URL."),
});

export interface AnalyzeResult {
  origin: string;
  /** Detected from homepage HTML markers, independent of catalog access. */
  platform: Platform;
  /** Whether we could actually read the catalog, and if not, why. */
  catalog: CatalogStatus;
  meta: SiteMetadata;
  products: ShopifyProduct[];
  productCount: number;
  /** Site refuses to be iframed, so the UI should skip the direct tier. */
  framingBlocked: boolean;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Send a JSON body with a `url` field." },
      { status: 400 },
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a store URL to analyse." },
      { status: 400 },
    );
  }

  let origin: string;
  try {
    origin = normalizeStoreUrl(parsed.data.url);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "That doesn't look like a valid URL.",
      },
      { status: 400 },
    );
  }

  const [store, scrape] = await Promise.all([
    fetchShopifyProducts(origin),
    scrapeSiteMetadata(origin),
  ]);

  // 502 only when the host itself never answered — a bot-walled store is
  // reachable and still makes a good demo.
  if (!scrape.reachable && store.catalog !== "ok") {
    return NextResponse.json(
      {
        error: `Couldn't reach ${origin}. Check the domain is right and the store is live.`,
      },
      { status: 502 },
    );
  }

  const platform = detectPlatform(scrape.html);
  const products = pickFeaturedProducts(store.products);

  // Catalog came back fine but nothing had both an image and a price, so
  // there's still nothing to render in a widget.
  const catalog: CatalogStatus =
    store.catalog === "ok" && products.length === 0 ? "empty" : store.catalog;

  const result: AnalyzeResult = {
    origin,
    platform,
    catalog,
    meta: scrape.meta,
    products,
    productCount: store.products.length,
    framingBlocked: scrape.framingBlocked,
  };

  return NextResponse.json(result);
}
