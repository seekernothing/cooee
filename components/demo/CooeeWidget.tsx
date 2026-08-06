"use client";

import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

import type { Brand, Campaign } from "@/lib/campaign";
import type { ShopifyProduct } from "@/lib/shopify";
import { cn } from "@/lib/utils";

interface CooeeWidgetProps {
  campaign: Campaign;
  brand: Brand;
  products: ShopifyProduct[];
}

/**
 * Every colour here comes from Gemini at runtime, so it must be applied as an
 * inline style. An interpolated Tailwind class (`bg-[${brand.primary}]`)
 * produces no CSS at build time and renders unstyled.
 */
export function CooeeWidget({ campaign, brand, products }: CooeeWidgetProps) {
  const reduceMotion = useReducedMotion();

  const product =
    products.find((p) => p.handle === campaign.featuredProductHandle) ?? null;

  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const };

  switch (campaign.surface) {
    case "announcement_bar":
      return (
        <motion.div
          initial={reduceMotion ? false : { y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={transition}
          className="absolute inset-x-0 top-0 z-20"
          style={{ backgroundColor: brand.primary, color: brand.onPrimary }}
        >
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2.5 text-center">
            {campaign.badge && (
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase"
                style={{ backgroundColor: brand.accent, color: brand.primary }}
              >
                {campaign.badge}
              </span>
            )}
            <span className="text-sm font-medium">{campaign.headline}</span>
            <span className="hidden text-xs opacity-80 sm:inline">
              {campaign.subline}
            </span>
            <button
              type="button"
              className="rounded-full px-3 py-1 text-xs font-semibold underline underline-offset-2"
              style={{ color: brand.onPrimary }}
            >
              {campaign.cta}
            </button>
          </div>
        </motion.div>
      );

    case "popup":
      return (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={transition}
            className="absolute inset-0 bg-black/40"
          />
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={transition}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <button
              type="button"
              aria-label="Close"
              className="absolute top-3 right-3 z-10 rounded-full bg-black/5 p-1.5 text-black/50"
            >
              <X className="size-3.5" />
            </button>

            {product?.image && (
              <div className="aspect-[16/10] w-full overflow-hidden bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image}
                  alt={product.title}
                  className="size-full object-cover"
                />
              </div>
            )}

            <div className="space-y-2.5 p-5">
              {campaign.badge && (
                <span
                  className="inline-block rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase"
                  style={{ backgroundColor: brand.accent, color: brand.primary }}
                >
                  {campaign.badge}
                </span>
              )}
              <h3 className="text-lg leading-snug font-semibold text-neutral-900">
                {campaign.headline}
              </h3>
              <p className="text-sm leading-relaxed text-neutral-600">
                {campaign.subline}
              </p>
              {product && <ProductLine product={product} />}
              <button
                type="button"
                className="mt-1 w-full rounded-lg px-4 py-2.5 text-sm font-semibold"
                style={{
                  backgroundColor: brand.primary,
                  color: brand.onPrimary,
                }}
              >
                {campaign.cta}
              </button>
            </div>
          </motion.div>
        </div>
      );

    case "pdp_embed":
      return (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
          className="absolute inset-x-0 bottom-0 z-20 p-4"
        >
          <div
            className="overflow-hidden rounded-xl bg-white shadow-xl"
            style={{ borderTop: `3px solid ${brand.primary}` }}
          >
            <div className="flex items-center gap-4 p-4">
              {product?.image && (
                <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={product.image}
                    alt={product.title}
                    className="size-full object-cover"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1 space-y-1">
                {campaign.badge && (
                  <span
                    className="inline-block rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase"
                    style={{
                      backgroundColor: brand.accent,
                      color: brand.primary,
                    }}
                  >
                    {campaign.badge}
                  </span>
                )}
                <p className="truncate text-sm font-semibold text-neutral-900">
                  {campaign.headline}
                </p>
                <p className="line-clamp-2 text-xs text-neutral-600">
                  {campaign.subline}
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg px-4 py-2 text-xs font-semibold whitespace-nowrap"
                style={{
                  backgroundColor: brand.primary,
                  color: brand.onPrimary,
                }}
              >
                {campaign.cta}
              </button>
            </div>
          </div>
        </motion.div>
      );

    case "cart_upsell":
      return (
        <motion.div
          initial={reduceMotion ? false : { x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={transition}
          className="absolute top-0 right-0 bottom-0 z-20 w-full max-w-[300px] bg-white shadow-2xl"
        >
          <div className="flex h-full flex-col">
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ backgroundColor: brand.primary, color: brand.onPrimary }}
            >
              <span className="font-mono text-[11px] tracking-wider uppercase">
                Your cart
              </span>
              <X className="size-4 opacity-70" />
            </div>

            <div className="flex-1 space-y-3 overflow-hidden p-4">
              {campaign.badge && (
                <span
                  className="inline-block rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase"
                  style={{ backgroundColor: brand.accent, color: brand.primary }}
                >
                  {campaign.badge}
                </span>
              )}
              <h3 className="text-base leading-snug font-semibold text-neutral-900">
                {campaign.headline}
              </h3>
              <p className="text-xs leading-relaxed text-neutral-600">
                {campaign.subline}
              </p>

              {product && (
                <div className="flex gap-3 rounded-lg border border-neutral-200 p-2.5">
                  {product.image && (
                    <div className="size-14 shrink-0 overflow-hidden rounded bg-neutral-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={product.image}
                        alt={product.title}
                        className="size-full object-cover"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-medium text-neutral-800">
                      {product.title}
                    </p>
                    {product.price && (
                      <p className="mt-1 text-xs font-semibold text-neutral-900">
                        {product.price}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 pt-0">
              <button
                type="button"
                className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold"
                style={{
                  backgroundColor: brand.primary,
                  color: brand.onPrimary,
                }}
              >
                {campaign.cta}
              </button>
            </div>
          </div>
        </motion.div>
      );
  }
}

function ProductLine({ product }: { product: ShopifyProduct }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t border-neutral-100 pt-2.5">
      <span className="min-w-0 truncate text-xs text-neutral-500">
        {product.title}
      </span>
      {product.price && (
        <span className="shrink-0 text-sm font-semibold text-neutral-900">
          {product.price}
        </span>
      )}
    </div>
  );
}

/**
 * Sits on the demo frame, never inside the widget — the popup has to read as
 * the real thing, so the disclosure lives on our chrome around it.
 */
export function SampleDataNote({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-mauve inline-flex items-center gap-1.5 font-mono text-[10px] tracking-wider uppercase",
        className,
      )}
    >
      <span className="bg-mauve/40 size-1 rounded-full" />
      Sample data
    </span>
  );
}
