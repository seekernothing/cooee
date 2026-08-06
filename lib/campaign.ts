import { z } from "zod";

export const INTENTS = ["low", "medium", "high"] as const;
export const SURFACES = [
  "announcement_bar",
  "popup",
  "pdp_embed",
  "cart_upsell",
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

export const BrandSchema = z.object({
  name: z.string().min(1),
  tone: z.string().min(1),
  primary: z.string().regex(HEX, "primary must be a #rrggbb hex colour"),
  accent: z.string().regex(HEX, "accent must be a #rrggbb hex colour"),
  onPrimary: z.string().regex(HEX, "onPrimary must be a #rrggbb hex colour"),
});

export const CampaignSchema = z.object({
  intent: z.enum(INTENTS),
  surface: z.enum(SURFACES),
  trigger: z.string().min(1),
  headline: z.string().min(1).max(60),
  subline: z.string().min(1).max(110),
  cta: z.string().min(1).max(22),
  badge: z.string().nullable(),
  featuredProductHandle: z.string().nullable(),
  whyItWorks: z.string().min(1).max(140),
});

export const CampaignSetSchema = z.object({
  brand: BrandSchema,
  campaigns: z
    .array(CampaignSchema)
    .length(3)
    .refine(
      (rows) => new Set(rows.map((r) => r.intent)).size === 3,
      "campaigns must cover low, medium and high exactly once",
    ),
});

export type Brand = z.infer<typeof BrandSchema>;
export type Campaign = z.infer<typeof CampaignSchema>;
export type CampaignSet = z.infer<typeof CampaignSetSchema>;
