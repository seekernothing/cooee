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

/** Static classes — the intent scale is ours, not the prospect's brand. */
const INTENT_DOT: Record<Intent, string> = {
  low: "bg-intent-low",
  medium: "bg-intent-med",
  high: "bg-intent-high",
};

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

          return (
            <button
              key={intent}
              role="tab"
              type="button"
              aria-selected={isActive}
              onClick={() => onChange(intent)}
              className={cn(
                "relative rounded-xl border px-4 py-3.5 text-left transition-colors",
                isActive
                  ? "border-rose bg-card shadow-soft"
                  : "hover:bg-blush/50 border-transparent",
              )}
            >
              {isActive && !reduceMotion && (
                <motion.span
                  layoutId="intent-active"
                  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                  className="border-rose bg-card shadow-soft absolute inset-0 rounded-xl border"
                />
              )}

              <span className="relative flex items-center gap-1.5">
                <span
                  className={cn("size-1.5 rounded-full", INTENT_DOT[intent])}
                />
                <span
                  className={cn(
                    "font-mono text-[11px] tracking-wider uppercase",
                    isActive ? "text-plum" : "text-mauve",
                  )}
                >
                  {INTENT_LABEL[intent]}
                </span>
              </span>

              <span className="relative mt-1 block text-xs text-balance">
                <span className={isActive ? "text-plum" : "text-mauve"}>
                  {INTENT_CAPTION[intent]}
                </span>
              </span>

              {campaign && (
                <span className="text-mauve relative mt-1.5 block truncate text-[11px]">
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
  return (
    <div className="space-y-4">
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
