import type { Brand, Campaign } from "@/lib/campaign";
import type { ShopifyProduct } from "@/lib/shopify";

/**
 * Fixture for developing widgets without burning Gemini calls.
 * Shapes and copy lengths mirror real generated output from Allbirds.
 */
export const MOCK_BRAND: Brand = {
  name: "Allbirds",
  tone: "sustainable comfort",
  primary: "#212121",
  accent: "#ece9e2",
  onPrimary: "#ffffff",
};

export const MOCK_PRODUCTS: ShopifyProduct[] = [
  {
    id: 1,
    title: "Men's Cruiser - Shadow Blue (Natural White Sole)",
    handle: "mens-cruiser-shadow-blue-natural-white-sole",
    vendor: "Allbirds",
    product_type: "Shoes",
    price: "105.00",
    compareAtPrice: null,
    image:
      "https://cdn.shopify.com/s/files/1/1104/4168/files/AB_Logo_Black.png?v=1653343394",
    url: "https://allbirds.com/products/mens-cruiser-shadow-blue-natural-white-sole",
  },
  {
    id: 2,
    title: "Women's Cruiser Slip On Canvas - Sea Spray",
    handle: "womens-cruiser-slip-on-canvas-sea-spray",
    vendor: "Allbirds",
    product_type: "Shoes",
    price: "100.00",
    compareAtPrice: "120.00",
    image:
      "https://cdn.shopify.com/s/files/1/1104/4168/files/AB_Logo_Black.png?v=1653343394",
    url: "https://allbirds.com/products/womens-cruiser-slip-on-canvas-sea-spray",
  },
  {
    id: 3,
    title: "Men's Cruiser Terralux - Anthracite (Dark Gum Sole)",
    handle: "mens-cruiser-terralux-anthracite",
    vendor: "Allbirds",
    product_type: "Shoes",
    price: "135.00",
    compareAtPrice: null,
    image:
      "https://cdn.shopify.com/s/files/1/1104/4168/files/AB_Logo_Black.png?v=1653343394",
    url: "https://allbirds.com/products/mens-cruiser-terralux-anthracite",
  },
];

export const MOCK_CAMPAIGNS: Campaign[] = [
  {
    intent: "low",
    surface: "announcement_bar",
    trigger: "Triggers when a new visitor lands on any page.",
    headline: "Made With Natural Materials",
    subline:
      "Experience supernatural comfort with free shipping and hassle-free returns on every order.",
    cta: "Explore Comfort",
    badge: null,
    featuredProductHandle: null,
    whyItWorks:
      "Softly highlights value props without offering discounts to cold traffic.",
  },
  {
    intent: "medium",
    surface: "pdp_embed",
    trigger: "Fires after 30 seconds viewing shoe product pages.",
    headline: "Step Into Ultimate Comfort",
    subline:
      "The Women's Cruiser Slip On Canvas is built with natural materials for all-day wear.",
    cta: "Shop Cruiser",
    badge: "12 people viewing",
    featuredProductHandle: "womens-cruiser-slip-on-canvas-sea-spray",
    whyItWorks:
      "Presents recommendations and social proof to engaged browsers who are comparing options.",
  },
  {
    intent: "high",
    surface: "cart_upsell",
    trigger: "Triggers when a visitor adds an item to cart or begins checkout.",
    headline: "Complete Your Comfort",
    subline:
      "Add the Men's Cruiser Terralux to your order and take 15% off at checkout.",
    cta: "Add To Order",
    badge: "Selling fast",
    featuredProductHandle: "mens-cruiser-terralux-anthracite",
    whyItWorks:
      "Cross-sells a premium pair at the moment of highest purchase intent, before checkout.",
  },
];

/** Popup isn't in the default set; used to exercise the fourth surface. */
export const MOCK_POPUP_CAMPAIGN: Campaign = {
  intent: "high",
  surface: "popup",
  trigger: "Fires on exit intent with items still in the cart.",
  headline: "Before You Go",
  subline: "Your picks are waiting. Take 15% off if you finish up today.",
  cta: "Claim 15% Off",
  badge: "Offer expires today",
  featuredProductHandle: "mens-cruiser-shadow-blue-natural-white-sole",
  whyItWorks:
    "Recovers an abandoning session with a discount only at the point of genuine exit risk.",
};
