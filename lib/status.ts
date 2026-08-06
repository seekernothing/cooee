import type { CatalogStatus, Platform } from "@/lib/shopify";

/**
 * The one-line note shown under the demo explaining what data it is built on.
 * Never says "failed" — a bot-protected catalog is a normal outcome, and the
 * audience for this tool is the prospect's own founder.
 */
export function catalogNote(
  platform: Platform,
  catalog: CatalogStatus,
): string | null {
  if (catalog === "ok") return null;

  if (platform === "shopify") {
    if (catalog === "blocked") {
      return "Shopify store detected. This store's catalog is bot-protected, so this demo uses brand voice without live products.";
    }
    if (catalog === "empty") {
      return "Shopify store detected. No published products came back, so this demo uses brand voice without live products.";
    }
  }

  return "No Shopify catalog detected here, so this demo is built from the site's brand signals alone.";
}
