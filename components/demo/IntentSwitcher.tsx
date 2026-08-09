"use client";

import { motion, useReducedMotion } from "motion/react";

import type { Campaign } from "@/lib/campaign";
import { INTENTS } from "@/lib/campaign";
import { cn } from "@/lib/utils";

type Intent = (typeof INTENTS)[number];

const INTENT_LABEL: Record<Intent, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const INTENT_CAPTION: Record<Intent, string> = {
  low: "Just landed",
  medium: "Comparing",
  high: "Ready to buy",
};

/**
 * Static classes — the intent scale is ours, not the prospect's brand.
 * Tailwind only emits classes it can see as literals, so each tier lists its
 * full set rather than interpolating a name.
 */
interface TierStyle {
  dot: string;
  ink: string;
  /** Selected-card surface + border. */
  surface: string;
  /** Filled segments of the strength meter. */
  meter: string;
  /** Left edge marker on the selected card. */
  edge: string;
}

const TIER: Record<Intent, TierStyle> = {
  low: {
    dot: "bg-intent-low",
    ink: "text-intent-low-ink",
    surface: "border-intent-low bg-intent-low-tint",
    meter: "bg-intent-low",
    edge: "bg-intent-low",
  },
  medium: {
    dot: "bg-intent-med",
    ink: "text-intent-med-ink",
    surface: "border-intent-med bg-intent-med-tint",
    meter: "bg-intent-med",
    edge: "bg-intent-med",
  },
  high: {
    dot: "bg-intent-high",
    ink: "text-intent-high-ink",
    surface: "border-intent-high bg-intent-high-tint",
    meter: "bg-intent-high",
    edge: "bg-intent-high",
  },
};

/** Filled segments out of 3 — gives the tier a non-colour cue. */
const TIER_STRENGTH: Record<Intent, number> = { low: 1, medium: 2, high: 3 };

const SURFACE_LABEL: Record<Campaign["surface"], string> = {
  announcement_bar: "Announcement bar",
  popup: "Personalised popup",
  pdp_embed: "PDP embed",
  cart_upsell: "Cart upsell",
};

interface IntentSwitcherProps {
  campaigns: Campaign[];
  active: Intent;
  onChange: (intent: Intent) => void;
}

export function IntentSwitcher({
  campaigns,
  active,
  onChange,
}: IntentSwitcherProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="space-y-4">
      <div className="intent-rail h-px w-full rounded-full" />

      <div
        role="tablist"
        aria-label="Visitor intent"
        className="grid grid-cols-3 gap-3"
      >
        {INTENTS.map((intent) => {
          const campaign = campaigns.find((c) => c.intent === intent);
          const isActive = intent === active;

          const tier = TIER[intent];
          const strength = TIER_STRENGTH[intent];

          return (
            <button
              key={intent}
              role="tab"
              type="button"
              aria-selected={isActive}
              aria-label={`${INTENT_LABEL[intent]} intent — ${INTENT_CAPTION[intent]}, strength ${strength} of 3`}
              onClick={() => onChange(intent)}
              className={cn(
                "relative overflow-hidden rounded-xl border px-4 py-3.5 text-left transition-all",
                isActive
                  ? cn(tier.surface, "shadow-soft")
                  : "border-rose/70 bg-card hover:border-rose hover:shadow-soft",
              )}
            >
              {/* Selected tier gets a solid colour edge — a shape cue that
                  survives greyscale and colour-blind viewing. */}
              {isActive && (
                <motion.span
                  layoutId={reduceMotion ? undefined : "intent-active"}
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className={cn(
                    "absolute inset-y-0 left-0 w-1 rounded-l-xl",
                    tier.edge,
                  )}
                />
              )}

              <span className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", tier.dot)} />
                  <span
                    className={cn(
                      "font-mono text-[11px] font-semibold tracking-wider uppercase",
                      isActive ? tier.ink : "text-mauve",
                    )}
                  >
                    {INTENT_LABEL[intent]}
                  </span>
                </span>

                {/* Strength meter: 1/2/3 filled bars. Encodes the tier without
                    relying on colour at all. */}
                <span className="flex items-end gap-0.5" aria-hidden="true">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className={cn(
                        "w-1 rounded-full transition-colors",
                        i === 0 ? "h-1.5" : i === 1 ? "h-2.5" : "h-3.5",
                        i < strength
                          ? tier.meter
                          : isActive
                            ? "bg-plum/15"
                            : "bg-rose",
                      )}
                    />
                  ))}
                </span>
              </span>

              <span className="relative mt-1.5 block text-xs text-balance">
                <span
                  className={cn(
                    isActive ? "text-plum font-medium" : "text-mauve",
                  )}
                >
                  {INTENT_CAPTION[intent]}
                </span>
              </span>

              {campaign && (
                <span
                  className={cn(
                    "relative mt-1.5 block truncate text-[11px]",
                    isActive ? "text-plum/70" : "text-mauve/80",
                  )}
                >
                  {SURFACE_LABEL[campaign.surface]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Trigger + rationale for the selected tier. */
export function IntentDetail({ campaign }: { campaign: Campaign }) {
  const tier = TIER[campaign.intent];

  return (
    <div className="space-y-4">
      {/* Echoes the selected tab's colour so the panel is visibly bound to it. */}
      <div className="flex items-center gap-2">
        <span className={cn("size-2 rounded-full", tier.dot)} />
        <span
          className={cn(
            "font-mono text-[11px] font-semibold tracking-wider uppercase",
            tier.ink,
          )}
        >
          {INTENT_LABEL[campaign.intent]} intent
        </span>
      </div>

      <div className="space-y-1.5">
        <p className="eyebrow">Fires when</p>
        <p className="text-plum text-sm leading-relaxed">{campaign.trigger}</p>
      </div>
      <div className="bg-rose/60 h-px w-full" />
      <div className="space-y-1.5">
        <p className="eyebrow">Why it works</p>
        <p className="text-plum text-sm leading-relaxed">
          {campaign.whyItWorks}
        </p>
      </div>
    </div>
  );
}
