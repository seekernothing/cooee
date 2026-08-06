"use client";

import { useState } from "react";

import { CooeeWidget, SampleDataNote } from "@/components/demo/CooeeWidget";
import {
  IntentDetail,
  IntentSwitcher,
} from "@/components/demo/IntentSwitcher";
import type { Campaign } from "@/lib/campaign";
import {
  MOCK_BRAND,
  MOCK_CAMPAIGNS,
  MOCK_POPUP_CAMPAIGN,
  MOCK_PRODUCTS,
} from "@/lib/mock";

type Intent = Campaign["intent"];

/**
 * Dev harness for step 4 — widgets against mock data, no API calls.
 * Not linked from the app.
 */
export default function PreviewPage() {
  const [active, setActive] = useState<Intent>("low");

  const campaign =
    MOCK_CAMPAIGNS.find((c) => c.intent === active) ?? MOCK_CAMPAIGNS[0];

  return (
    <main className="porcelain-grain min-h-screen p-6 md:p-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-2">
          <p className="eyebrow">Widget preview · mock data</p>
          <h1 className="text-4xl">All four surfaces</h1>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
          <div className="space-y-3">
            <DemoFrame>
              <CooeeWidget
                campaign={campaign}
                brand={MOCK_BRAND}
                products={MOCK_PRODUCTS}
              />
            </DemoFrame>
            <IntentSwitcher
              campaigns={MOCK_CAMPAIGNS}
              active={active}
              onChange={setActive}
            />
          </div>

          <aside className="bg-card border-rose shadow-soft rounded-xl border p-5">
            <IntentDetail campaign={campaign} />
          </aside>
        </div>

        <div className="space-y-3">
          <p className="eyebrow">Popup surface</p>
          <DemoFrame>
            <CooeeWidget
              campaign={MOCK_POPUP_CAMPAIGN}
              brand={MOCK_BRAND}
              products={MOCK_PRODUCTS}
            />
          </DemoFrame>
        </div>
      </div>
    </main>
  );
}

/** Stand-in for SiteFrame (step 5) so widgets have somewhere to sit. */
function DemoFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="border-rose shadow-lift bg-card relative aspect-[16/10] overflow-hidden rounded-xl border">
        <div className="absolute inset-0 grid place-items-center bg-neutral-100">
          <span className="font-mono text-xs text-neutral-400">
            storefront preview
          </span>
        </div>
        {children}
      </div>
      <div className="flex justify-end">
        <SampleDataNote />
      </div>
    </div>
  );
}
