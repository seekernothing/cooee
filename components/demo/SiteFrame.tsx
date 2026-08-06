"use client";

import { useEffect, useRef, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

type Tier = "direct" | "proxy" | "shot";

const LOAD_TIMEOUT_MS = 3000;
const PROXY_TIMEOUT_MS = 8000;

interface SiteFrameProps {
  origin: string;
  children?: React.ReactNode;
  /** Rendered on the frame chrome, outside the storefront. */
  note?: React.ReactNode;
  /**
   * Set when analyze saw x-frame-options / frame-ancestors. A CSP-blocked
   * iframe fires neither load nor error, so without this hint the only signal
   * is a timeout — this skips that dead wait entirely.
   */
  framingBlocked?: boolean;
}

/**
 * Three-tier fallback: direct iframe → proxied HTML → static screenshot.
 *
 * Frame-blocking headers usually produce no error event at all, so a load
 * that hasn't completed within 4s counts as failure and we move down a tier.
 */
export function SiteFrame(props: SiteFrameProps) {
  // Remount on origin change so tier/loaded reset without a cascading render.
  return <SiteFrameInner key={props.origin} {...props} />;
}

function SiteFrameInner({
  origin,
  children,
  note,
  framingBlocked = false,
}: SiteFrameProps) {
  const [tier, setTier] = useState<Tier>(framingBlocked ? "proxy" : "direct");
  const [loaded, setLoaded] = useState(false);
  const [shotFailed, setShotFailed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (tier === "shot" || loaded) return;

    // The proxy serves a full storefront (often several hundred KB), so it
    // needs longer than the direct attempt before we call it a failure.
    const budget = tier === "direct" ? LOAD_TIMEOUT_MS : PROXY_TIMEOUT_MS;

    timerRef.current = setTimeout(() => {
      setTier((current) => (current === "direct" ? "proxy" : "shot"));
      setLoaded(false);
    }, budget);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [tier, loaded, origin]);

  /**
   * A frame-blocked iframe still fires onLoad — the browser's own "refused to
   * connect" page counts as a successful load, which is why onLoad alone can't
   * detect failure.
   *
   * The reliable signal is cross-origin isolation. A storefront that really
   * loaded is cross-origin, so touching contentDocument throws a SecurityError.
   * The browser's error page is same-origin (about:blank-like), so it reads
   * back fine — an accessible document therefore means the load failed.
   */
  const handleIframeLoad = (
    event: React.SyntheticEvent<HTMLIFrameElement>,
  ) => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (tier === "direct") {
      let blocked = false;
      try {
        const doc = event.currentTarget.contentDocument;
        // Readable + empty body = the browser's error page, not the store.
        if (doc && (doc.body?.childElementCount ?? 0) === 0) blocked = true;
      } catch {
        blocked = false; // SecurityError: genuinely cross-origin, so it loaded
      }

      if (blocked) {
        setTier("proxy");
        setLoaded(false);
        return;
      }
    }

    setLoaded(true);
  };

  const handleLoad = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoaded(true);
  };

  const handleError = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setTier((current) => (current === "direct" ? "proxy" : "shot"));
    setLoaded(false);
  };

  const host = safeHost(origin);

  return (
    <div className="space-y-2.5">
      <div className="border-rose shadow-lift bg-card overflow-hidden rounded-2xl border">
        {/* Browser chrome — reads as "your store", not "an iframe" */}
        <div className="border-rose bg-blush/40 flex items-center gap-3 border-b px-4 py-3">
          <div className="flex gap-2">
            <span className="bg-rose size-3 rounded-full" />
            <span className="bg-rose size-3 rounded-full" />
            <span className="bg-rose size-3 rounded-full" />
          </div>
          <div className="bg-card border-rose text-mauve mx-auto max-w-[70%] truncate rounded-full border px-4 py-1 font-mono text-xs">
            {host}
          </div>
        </div>

        <div className="relative aspect-[16/10] max-h-[68vh] w-full overflow-hidden bg-white">
          {!loaded && (
            <div className="absolute inset-0 z-10 space-y-3 bg-white p-6">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-40 w-full" />
              <div className="flex gap-3">
                <Skeleton className="h-20 flex-1" />
                <Skeleton className="h-20 flex-1" />
                <Skeleton className="h-20 flex-1" />
              </div>
            </div>
          )}

          {shotFailed ? (
            /* Every tier refused. A calm neutral surface still demos the
               widget; a broken image or blank box does not. */
            <div className="bg-blush/30 absolute inset-0 flex flex-col gap-3 p-6">
              <div className="bg-rose/40 h-8 w-1/3 rounded" />
              <div className="bg-rose/25 flex-1 rounded" />
              <div className="flex gap-3">
                <div className="bg-rose/25 h-16 flex-1 rounded" />
                <div className="bg-rose/25 h-16 flex-1 rounded" />
                <div className="bg-rose/25 h-16 flex-1 rounded" />
              </div>
            </div>
          ) : tier === "shot" ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={`shot-${origin}`}
              src={`/api/shot?url=${encodeURIComponent(origin)}`}
              alt={`Screenshot of ${host}`}
              className="size-full object-cover object-top"
              onLoad={handleLoad}
              onError={() => {
                // Never leave a broken-image icon behind the widget.
                if (timerRef.current) clearTimeout(timerRef.current);
                setShotFailed(true);
                setLoaded(true);
              }}
            />
          ) : (
            <iframe
              key={`${tier}-${origin}`}
              src={
                tier === "direct"
                  ? origin
                  : `/api/proxy?url=${encodeURIComponent(origin)}`
              }
              title={`${host} storefront`}
              className="size-full border-0"
              // Deliberately no allow-same-origin on the proxy tier: it puts
              // the document in an opaque origin, which is what stops the
              // store's own frame-ancestors CSP from re-blocking us.
              sandbox={
                tier === "direct"
                  ? "allow-scripts allow-same-origin allow-forms allow-popups"
                  : "allow-scripts allow-forms allow-popups"
              }
              referrerPolicy="no-referrer"
              loading="eager"
              onLoad={handleIframeLoad}
              onError={handleError}
            />
          )}

          {/* Widgets sit above the storefront */}
          {children}
        </div>
      </div>

      {note && <div className="flex justify-end">{note}</div>}
    </div>
  );
}

function safeHost(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}
