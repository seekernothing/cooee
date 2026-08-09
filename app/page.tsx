"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { CooeeWidget, SampleDataNote } from "@/components/demo/CooeeWidget";
import { GridBay } from "@/components/demo/GridBay";
import { IntentDetail, IntentSwitcher } from "@/components/demo/IntentSwitcher";
import { SiteFrame } from "@/components/demo/SiteFrame";
import { CornerButton } from "@/components/ui/corner-button";
import { Input } from "@/components/ui/input";
import type { Campaign, CampaignSet } from "@/lib/campaign";
import type { ShopifyProduct, CatalogStatus, Platform } from "@/lib/shopify";
import { catalogNote } from "@/lib/status";

type Intent = Campaign["intent"];

interface AnalyzeResult {
  origin: string;
  platform: Platform;
  catalog: CatalogStatus;
  meta: {
    title: string | null;
    description: string | null;
    ogImage: string | null;
    favicon: string | null;
    themeColor: string | null;
    siteName: string | null;
  };
  products: ShopifyProduct[];
  productCount: number;
  framingBlocked: boolean;
}

const STAGES = [
  "Reading catalog",
  "Matching brand",
  "Writing campaigns",
] as const;

function safeHost(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [stage, setStage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);
  const [result, setResult] = useState<CampaignSet | null>(null);
  const [active, setActive] = useState<Intent>("low");

  const busy = stage !== null;

  async function handleGenerate(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !url.trim()) return;

    setError(null);
    setResult(null);
    setAnalysis(null);
    setActive("low");
    setStage(0);

    try {
      const analyzeRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const analyzeJson = await analyzeRes.json();

      if (!analyzeRes.ok) {
        setError(analyzeJson.error ?? "Couldn't read that store.");
        setStage(null);
        return;
      }

      setAnalysis(analyzeJson);
      setStage(1);

      // Brief beat so the brand-matching stage is legible, not a flash.
      await new Promise((resolve) => setTimeout(resolve, 400));
      setStage(2);

      const generateRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analyzeJson),
      });
      const generateJson = await generateRes.json();

      if (!generateRes.ok) {
        setError(generateJson.error ?? "Couldn't write campaigns for that store.");
        setStage(null);
        return;
      }

      setResult(generateJson);
      setStage(null);
    } catch {
      setError("The connection dropped before the demo finished. Try again.");
      setStage(null);
    }
  }

  const campaign =
    result?.campaigns.find((c) => c.intent === active) ?? result?.campaigns[0];

  const note = analysis ? catalogNote(analysis.platform, analysis.catalog) : null;

  return (
    <main className="porcelain-grain min-h-screen px-5 py-12 md:px-10 md:py-16">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col items-center space-y-12">
        <header className="flex max-w-2xl flex-col items-center space-y-5 text-center">
          <div className="intent-rail h-px w-24 rounded-full" />
          <p className="eyebrow">Demo generator</p>
          <h1 className="text-5xl md:text-6xl">
            See Cooee live on{" "}
            <span className="text-lacquer italic">your store</span>
          </h1>
          <p className="text-mauve text-lg text-balance">
            Paste a store URL. Get personalised campaigns for every intent tier.
          </p>

          <form
            onSubmit={handleGenerate}
            className="flex w-full flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-3"
          >
            <Input
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="allbirds.com"
              aria-label="Store URL"
              disabled={busy}
              className="bg-card h-11 w-full sm:max-w-sm sm:flex-1"
            />
            <CornerButton
              type="submit"
              disabled={busy || !url.trim()}
              accentColor="var(--lacquer)"
              labelColor="#fff"
              showIcon={false}
              /* The wrapper adds its own padding for the corner animation, so
                 the button is left to size itself — forcing a height here
                 leaves a dead, unclickable ring around the visible button. */
              className="whitespace-nowrap"
              wrapperClassName="shrink-0"
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating
                </>
              ) : (
                <>
                  Generate demo
                  <ArrowRight className="size-4" />
                </>
              )}
            </CornerButton>
          </form>

          {busy && (
            <ol className="flex flex-col items-center space-y-1.5 pt-1">
              {STAGES.map((label, index) => {
                const state =
                  stage === null || index > stage
                    ? "pending"
                    : index < stage
                      ? "done"
                      : "active";
                return (
                  <li
                    key={label}
                    className="flex items-center gap-2.5 font-mono text-[11px] tracking-wider uppercase"
                  >
                    <span
                      className={
                        state === "done"
                          ? "bg-intent-high size-1.5 rounded-full"
                          : state === "active"
                            ? "bg-intent-med size-1.5 animate-pulse rounded-full"
                            : "bg-rose size-1.5 rounded-full"
                      }
                    />
                    <span
                      className={state === "pending" ? "text-mauve/50" : "text-plum"}
                    >
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {error && (
            <div
              role="alert"
              className="border-rose bg-blush/60 text-plum rounded-xl border px-4 py-3 text-sm"
            >
              {error}
            </div>
          )}
        </header>

        {result && analysis && campaign && (
          /* The drafting sheet: every generated component is plated on the
             blueprint field and registered with corner crosshairs. */
          <section className="border-rose relative w-full rounded-2xl border p-4 md:p-8">
            <span className="crosshair tl" aria-hidden="true" />
            <span className="crosshair tr" aria-hidden="true" />
            <span className="crosshair bl" aria-hidden="true" />
            <span className="crosshair br" aria-hidden="true" />

            <div className="mb-5 flex items-baseline justify-between gap-3">
              <span className="bay-label">Sheet 01 · Generated campaign</span>
              <span className="bay-label text-mauve/60">
                {safeHost(analysis.origin)}
              </span>
            </div>

            {/* The storefront column takes the surplus width; the rail stays a
                fixed reading column so it doesn't stretch with the viewport. */}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:gap-8">
              <div className="space-y-6">
                <GridBay label="Fig. 01 — Storefront + widget" spec="Live frame">
                  <SiteFrame
                    origin={analysis.origin}
                    framingBlocked={analysis.framingBlocked}
                    note={campaign.badge ? <SampleDataNote /> : null}
                  >
                    <CooeeWidget
                      campaign={campaign}
                      brand={result.brand}
                      products={analysis.products}
                    />
                  </SiteFrame>
                </GridBay>

                <GridBay label="Fig. 02 — Intent scale" spec="3 tiers">
                  <IntentSwitcher
                    campaigns={result.campaigns}
                    active={active}
                    onChange={setActive}
                  />
                </GridBay>
              </div>

              <aside className="space-y-6">
                <GridBay label="Fig. 03 — Trigger spec">
                  <div className="bg-card border-rose shadow-soft rounded-xl border p-5">
                    <IntentDetail campaign={campaign} />
                  </div>
                </GridBay>

                <GridBay label="Fig. 04 — Brand read">
                  <div className="bg-card border-rose shadow-soft space-y-3.5 rounded-xl border p-5">
                    <p className="text-plum text-sm">
                      {result.brand.name}
                      <span className="text-mauve"> · {result.brand.tone}</span>
                    </p>
                    <div className="flex gap-2">
                      {[result.brand.primary, result.brand.accent].map((hex) => (
                        <div key={hex} className="flex items-center gap-1.5">
                          <span
                            className="border-rose size-4 rounded-full border"
                            style={{ backgroundColor: hex }}
                          />
                          <span className="text-mauve font-mono text-[10px] uppercase">
                            {hex}
                          </span>
                        </div>
                      ))}
                    </div>
                    {note && (
                      <p className="text-mauve border-rose border-t pt-3 text-xs leading-relaxed">
                        {note}
                      </p>
                    )}
                  </div>
                </GridBay>
              </aside>
            </div>
          </section>
        )}

        {!result && !busy && (
          <p className="text-mauve/70 text-center text-sm">
            Try a live Shopify store — allbirds.com, rothys.com.
          </p>
        )}
      </div>
    </main>
  );
}

