"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";

import { CooeeWidget, SampleDataNote } from "@/components/demo/CooeeWidget";
import { IntentDetail, IntentSwitcher } from "@/components/demo/IntentSwitcher";
import { SiteFrame } from "@/components/demo/SiteFrame";
import { Button } from "@/components/ui/button";
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
      <div className="mx-auto max-w-6xl space-y-12">
        <header className="max-w-2xl space-y-5">
          <div className="intent-rail h-px w-24 rounded-full" />
          <p className="eyebrow">Demo generator</p>
          <h1 className="text-5xl md:text-6xl">
            See Cooee live on{" "}
            <span className="text-lacquer italic">your store</span>
          </h1>
          <p className="text-mauve text-lg text-balance">
            Paste a store URL. Get personalised campaigns for every intent tier.
          </p>

          <form onSubmit={handleGenerate} className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="text"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="allbirds.com"
              aria-label="Store URL"
              disabled={busy}
              className="bg-card h-11 flex-1"
            />
            <Button
              type="submit"
              disabled={busy || !url.trim()}
              className="shadow-lacquer h-11 px-5"
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
            </Button>
          </form>

          {busy && (
            <ol className="space-y-1.5 pt-1">
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
          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-6">
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

              <IntentSwitcher
                campaigns={result.campaigns}
                active={active}
                onChange={setActive}
              />
            </div>

            <aside className="space-y-6">
              <div className="bg-card border-rose shadow-soft rounded-2xl border p-6">
                <IntentDetail campaign={campaign} />
              </div>

              <div className="bg-card border-rose shadow-soft space-y-3.5 rounded-2xl border p-6">
                <p className="eyebrow">Brand read</p>
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
            </aside>
          </section>
        )}

        {!result && !busy && (
          <p className="text-mauve/70 text-sm">
            Try a live Shopify store — allbirds.com, rothys.com.
          </p>
        )}
      </div>
    </main>
  );
}

