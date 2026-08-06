import { GoogleGenAI, ThinkingLevel, Type, type Schema } from "@google/genai";
import { NextResponse } from "next/server";
import { z } from "zod";

import { CampaignSetSchema, type CampaignSet } from "@/lib/campaign";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * gemini-2.5-flash is retired for new API keys (404 "no longer available to
 * new users"). Verified against this key: 3.6-flash answers our multimodal
 * structured-output call in ~4s, 3.5-flash in ~11s, flash-latest 503s.
 */
const MODEL = "gemini-3.6-flash";

/**
 * Free-tier quota is counted per model (20 req/day each), so a exhausted
 * primary does not mean the key is dead. Falling back keeps the demo working
 * on a busy day; 3.5-flash is slower but produces the same schema.
 */
const FALLBACK_MODELS = ["gemini-3.5-flash"] as const;

/**
 * A currency symbol next to digits ("$75", "75 GBP"), or a bare decimal
 * amount ("75.00"). Deliberately does NOT match a percentage — round
 * discounts are a campaign setting the salesperson controls, not a claim
 * about this store's catalog.
 */
const MONEY_PATTERN =
  /[$£€¥₹]\s?\d|\d+\s?(?:USD|GBP|EUR|INR|AUD|CAD)\b|\b\d+\.\d{2}\b/i;

/** Model stated a fact it could not know. Distinct from a schema failure. */
class InventedFactError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "InventedFactError";
  }
}

function isRateLimit(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    (error as { status?: number }).status === 429 ||
    /RESOURCE_EXHAUSTED|quota|rate limit/i.test(error.message)
  );
}

/**
 * The API reports how long to wait ("Please retry in 16.6s"). Honour it when
 * it is short enough to stay inside the request budget.
 */
function retryDelayMs(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const match = error.message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (!match) return null;
  const ms = Math.ceil(Number(match[1]) * 1000) + 500;
  return ms > 0 && ms <= 20000 ? ms : null;
}

const ProductInput = z.object({
  title: z.string(),
  handle: z.string(),
  price: z.string().nullable(),
  compareAtPrice: z.string().nullable(),
  product_type: z.string().optional().default(""),
  vendor: z.string().optional().default(""),
});

const RequestSchema = z.object({
  origin: z.string(),
  platform: z.enum(["shopify", "unknown"]).default("unknown"),
  catalog: z.enum(["ok", "blocked", "empty", "none"]).default("none"),
  meta: z.object({
    title: z.string().nullable(),
    description: z.string().nullable(),
    ogImage: z.string().nullable(),
    siteName: z.string().nullable(),
    themeColor: z.string().nullable(),
  }),
  products: z.array(ProductInput).default([]),
});

/** Mirrors CampaignSetSchema — constrains the model at decode time. */
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  required: ["brand", "campaigns"],
  properties: {
    brand: {
      type: Type.OBJECT,
      required: ["name", "tone", "primary", "accent", "onPrimary"],
      properties: {
        name: { type: Type.STRING },
        tone: {
          type: Type.STRING,
          description: 'Two words, e.g. "playful premium", "clinical minimal"',
        },
        primary: { type: Type.STRING, description: "Hex colour, #rrggbb" },
        accent: { type: Type.STRING, description: "Hex colour, #rrggbb" },
        onPrimary: {
          type: Type.STRING,
          description:
            "Hex colour, #rrggbb. Text colour placed on primary; must reach 4.5:1 contrast against it.",
        },
      },
    },
    campaigns: {
      type: Type.ARRAY,
      minItems: "3",
      maxItems: "3",
      items: {
        type: Type.OBJECT,
        required: [
          "intent",
          "surface",
          "trigger",
          "headline",
          "subline",
          "cta",
          "badge",
          "featuredProductHandle",
          "whyItWorks",
        ],
        properties: {
          intent: { type: Type.STRING, format: "enum", enum: ["low", "medium", "high"] },
          surface: {
            type: Type.STRING,
            format: "enum",
            enum: ["announcement_bar", "popup", "pdp_embed", "cart_upsell"],
          },
          trigger: {
            type: Type.STRING,
            description: "Plain English: when this fires. One sentence.",
          },
          headline: { type: Type.STRING, description: "60 characters or fewer" },
          subline: { type: Type.STRING, description: "110 characters or fewer" },
          cta: { type: Type.STRING, description: "22 characters or fewer" },
          badge: {
            type: Type.STRING,
            nullable: true,
            description: 'Optional chip, e.g. "12 people viewing". Null if unused.',
          },
          featuredProductHandle: {
            type: Type.STRING,
            nullable: true,
            description:
              "Must exactly match a handle from the supplied catalog, or be null.",
          },
          whyItWorks: {
            type: Type.STRING,
            description: "140 characters or fewer. The sales rationale.",
          },
        },
      },
    },
  },
};

const SYSTEM_RULES = `You write onsite personalisation campaigns for Cooee, an AI personalisation app for Shopify stores.

Cooee reads live buying intent and segments visitors into low, medium and high intent. Its real surfaces are announcement bars, 1-to-1 personalised popups, page embeds (carousels, bundles, shoppable video), and cart upsell/cross-sell. Never write a generic "join our newsletter" popup — that is not a Cooee surface.

Map intent to surface:
- low (just landed, browsing): announcement_bar. Soft value prop — shipping, returns, provenance, craft. NEVER offer a discount at low intent; that burns margin on someone who was not going to buy.
- medium (viewing products, comparing): pdp_embed. Bundles, social proof, recommendations.
- high (cart or exit hesitation): cart_upsell or popup. This is the only tier where a discount is appropriate.

All three campaigns must be visibly distinct in surface and in wording. Match the brand's own voice, derived from its name, description and imagery. Widgets should read as though the store's own design team built them.

Colours: derive primary and accent from the brand's actual visual identity. onPrimary must be legible on primary at 4.5:1 or better — near-white on a dark primary, near-black on a light or saturated-pastel primary.

The badge field is a small social-proof or urgency chip ("12 people viewing", "Selling fast"). Live figures like viewer counts are illustrative of what Cooee would show once installed, and the demo frame labels them as sample data outside the widget — so write them naturally and do not hedge inside the copy. Use badge only where it earns its place; null is right for a calm low-intent bar.`;

function buildCatalogMode(products: z.infer<typeof ProductInput>[]) {
  const lines = products
    .map(
      (p) =>
        `- handle: ${p.handle}\n  title: ${p.title}\n  price: ${p.price ?? "unknown"}${
          p.compareAtPrice ? ` (was ${p.compareAtPrice})` : ""
        }${p.product_type ? `\n  type: ${p.product_type}` : ""}`,
    )
    .join("\n");

  return `MODE: LIVE CATALOG.

These are real products from this store:
${lines}

Rules for this mode:
- Reference these actual products by their real titles. Never write a placeholder like "Product Name" or "our bestseller".
- featuredProductHandle must exactly match one of the handles above, or be null.
- Prices are in the store's own currency. Reproduce the numeral exactly as given and do not attach a currency symbol you were not given. If you are unsure of the currency, refer to the product without a price.
- Do not invent prices, discounts percentages tied to a specific amount, or product variants that are not listed.`;
}

function buildBrandOnlyMode(reason: "blocked" | "empty" | "none") {
  const situation =
    reason === "blocked"
      ? "This store's catalog endpoint is bot-protected, so no live product data is available."
      : reason === "empty"
        ? "This store's catalog returned no published products."
        : "No product catalog is available for this site.";

  return `MODE: BRAND VOICE ONLY.

${situation}

Rules for this mode — these are absolute:
- You have NO product data. You must NOT invent a product name, product title, price, or variant. Not even a plausible-sounding one.
- featuredProductHandle MUST be null for all three campaigns.
- Write copy that references the brand and its general category only — what it sells as a category ("training gear", "skincare"), its positioning, shipping and returns, community, craft. Never a specific item.
- Never state an absolute money amount ANYWHERE, in any context, because you do not know this store's prices or even its currency. This bans product prices and equally bans shipping and offer thresholds — no "free delivery over $75", no "$10 off", no minimum spend. Say "free delivery" or "free returns" unqualified, or do not mention them.

What you MAY name: campaign settings, because the salesperson configures those rather than reading them from the catalog. At high intent you may offer a round percentage discount — 10%, 15% or 20% — and say it plainly ("Take 15% off your order"). Prefer this to a vague evasion like "an extra percentage off", which reads as broken copy.

What you may NOT name: anything that would be a fact about this store you have not been given — product names, prices, stock counts, review counts, ratings, or live traffic numbers ("2,000 shoppers today").
- headline and subline must still feel specific to THIS brand's voice, not generic ecommerce filler.`;
}

async function fetchImagePart(url: string | null) {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(6000),
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) return null;

    const mimeType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!mimeType.startsWith("image/")) return null;

    const buffer = await res.arrayBuffer();
    // Keep the request light; oversized hero images add latency for no gain.
    if (buffer.byteLength > 4_000_000) return null;

    return {
      inlineData: {
        mimeType,
        data: Buffer.from(buffer).toString("base64"),
      },
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "The demo generator isn't configured yet. GEMINI_API_KEY is missing." },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send the analyze payload as JSON." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "That analyze payload looks incomplete. Run the analysis again." },
      { status: 400 },
    );
  }

  const { origin, platform, catalog, meta, products } = parsed.data;
  const hasProducts = products.length > 0;

  const brief = [
    `Store URL: ${origin}`,
    `Brand name: ${meta.siteName ?? meta.title ?? origin}`,
    meta.title ? `Page title: ${meta.title}` : null,
    meta.description ? `Description: ${meta.description}` : null,
    meta.themeColor ? `Declared theme colour: ${meta.themeColor}` : null,
    `Platform: ${platform === "shopify" ? "Shopify" : "not detected as Shopify"}`,
  ]
    .filter(Boolean)
    .join("\n");

  const modeBlock = hasProducts
    ? buildCatalogMode(products)
    : buildBrandOnlyMode(catalog === "ok" ? "empty" : catalog);

  const imagePart = await fetchImagePart(meta.ogImage);

  const parts: Array<Record<string, unknown>> = [
    { text: `${SYSTEM_RULES}\n\n---\n\n${brief}\n\n---\n\n${modeBlock}` },
  ];
  if (imagePart) {
    parts.push({
      text: "This is the brand's own hero image. Derive the palette from it.",
    });
    parts.push(imagePart);
  }

  const ai = new GoogleGenAI({ apiKey });

  const attempt = async (
    extraNote?: string,
    model: string = MODEL,
  ): Promise<CampaignSet> => {
    const attemptParts = extraNote ? [...parts, { text: extraNote }] : parts;

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: attemptParts }],
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.9,
        // Copywriting to a fixed schema doesn't need deep reasoning, and the
        // default budget pushed this call past 60s.
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

    const raw = response.text;
    if (!raw) throw new Error("empty response");

    const json: unknown = JSON.parse(raw);
    const validated = CampaignSetSchema.parse(json);

    // With no catalog we have no prices and no currency, so any money amount
    // in the copy is fabricated. Reject so the retry can fix it rather than
    // shipping an invented "free delivery over $75" to a prospect.
    if (!hasProducts) {
      const invented = validated.campaigns.find((c) =>
        MONEY_PATTERN.test(`${c.headline} ${c.subline} ${c.cta} ${c.badge ?? ""}`),
      );
      if (invented) {
        throw new InventedFactError(
          `the ${invented.intent}-intent copy stated a money amount for a store whose catalog we could not read`,
        );
      }
    }

    // The model occasionally hallucinates a handle. Null it rather than
    // letting the widget try to resolve a product that does not exist.
    const known = new Set(products.map((p) => p.handle));
    return {
      ...validated,
      campaigns: validated.campaigns.map((campaign) => ({
        ...campaign,
        featuredProductHandle:
          campaign.featuredProductHandle && known.has(campaign.featuredProductHandle)
            ? campaign.featuredProductHandle
            : null,
      })),
    };
  };

  try {
    let result: CampaignSet;
    try {
      result = await attempt();
    } catch (firstError) {
      // A rate limit isn't a bad response, so re-sending the same prompt to
      // the same model just burns the retry. Quota is counted per model, so
      // try a fallback first; if that is also capped, honour the API's own
      // retry interval when it is short enough to wait out.
      if (isRateLimit(firstError)) {
        let recovered: CampaignSet | null = null;

        for (const fallback of FALLBACK_MODELS) {
          try {
            recovered = await attempt(undefined, fallback);
            break;
          } catch (fallbackError) {
            if (!isRateLimit(fallbackError)) throw fallbackError;
          }
        }

        if (recovered) {
          result = recovered;
        } else {
          const wait = retryDelayMs(firstError);
          if (wait === null) throw firstError;
          await new Promise((resolve) => setTimeout(resolve, wait));
          result = await attempt();
        }
      } else {
        const note =
          firstError instanceof z.ZodError
            ? `Your previous response was rejected: ${firstError.issues
                .map((i) => `${i.path.join(".")}: ${i.message}`)
                .join("; ")}. Respect every length limit exactly.`
            : firstError instanceof InventedFactError
              ? `Your previous response was rejected because ${firstError.message}. Remove every currency symbol and money amount from all copy — including shipping and offer thresholds. A round percentage discount is still allowed at high intent.`
              : "Your previous response could not be parsed. Return valid JSON matching the schema.";
        result = await attempt(note);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    // Server-side only; the client gets the plain-language message below.
    console.error("[generate] failed:", error);

    if (isRateLimit(error)) {
      const daily = /PerDay|per day/i.test(
        error instanceof Error ? error.message : "",
      );
      return NextResponse.json(
        {
          error: daily
            ? "The Gemini free-tier daily limit for this key is used up. It resets every 24 hours, or add billing to the key to keep going."
            : "Gemini is rate-limiting this key right now. Wait about a minute and generate again.",
        },
        { status: 429 },
      );
    }

    const detail =
      error instanceof z.ZodError
        ? "the copy didn't fit the required format"
        : error instanceof InventedFactError
          ? "the copy kept inventing prices this store's catalog doesn't expose"
          : "the Gemini API call failed";

    return NextResponse.json(
      { error: `Couldn't write campaigns for ${origin} — ${detail}. Try generating again.` },
      { status: 502 },
    );
  }
}
